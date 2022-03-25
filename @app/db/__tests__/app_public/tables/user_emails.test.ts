import {
  withUserDb,
  snapshotSafe,
  asRoot,
  withRootDb,
  createUsers,
  becomeUser,
} from "../../helpers";
import { PoolClient } from "pg";

async function addEmail(client: PoolClient, email: string) {
  const {
    rows: [row],
  } = await client.query(
    `insert into app_public.user_emails (email) values ($1) returning *`,
    [email]
  );
  return row;
}

it("can add an email (unverified), receive code, verify email (and marks account as verified)", () =>
  withUserDb(async (client, user) => {
    const email = await addEmail(client, "newemail@example.com");
    expect(email).toBeTruthy();
    expect(email.user_id).toEqual(user.id);
    expect(snapshotSafe(email)).toMatchInlineSnapshot(`
      Object {
        "created_at": "[DATE]",
        "email": "newemail@example.com",
        "id": "[ID]",
        "is_primary": false,
        "is_verified": false,
        "updated_at": "[DATE]",
        "user_id": "[ID]",
      }
    `);
  }));

it("cannot manually create a verified email", () =>
  withUserDb(async client => {
    const promise = client.query(
      `insert into app_public.user_emails (email, is_verified) values ($1, true) returning *`,
      ["newemail@example.com"]
    );
    await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
      `"permission denied for table user_emails"`
    );
  }));

it("cannot manually mark an email as verified", () =>
  withUserDb(async client => {
    const email = await addEmail(client, "newemail@example.com");
    const promise = client.query(
      "update app_public.user_emails set is_verified = true where id = $1",
      [email.id]
    );
    await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
      `"permission denied for table user_emails"`
    );
  }));

it("can promote a verified email to primary over another verified email", () =>
  withUserDb(async client => {
    const email = await addEmail(client, "newemail@example.com");
    expect(email.is_verified).toBe(false);
    expect(email.is_primary).toBe(false);
    // Mark email verified
    await asRoot(client, () =>
      client.query(
        "update app_public.user_emails set is_verified = true where id = $1",
        [email.id]
      )
    );
    const {
      rows: [email2],
    } = await client.query("select * from app_public.make_email_primary($1)", [
      email.id,
    ]);
    expect(email2.id).toBe(email.id);
    expect(email2.is_verified).toBe(true);
    expect(email2.is_primary).toBe(true);
  }));

it("can promote a verified email to primary over an unverified email", () =>
  withRootDb(async client => {
    const [user] = await createUsers(client, 1, false);
    await becomeUser(client, user);
    const email = await addEmail(client, "newemail@example.com");
    expect(email.is_primary).toBe(false);
    // Mark new email verified
    await asRoot(client, () =>
      client.query(
        "update app_public.user_emails set is_verified = true where id = $1",
        [email.id]
      )
    );
    const {
      rows: [email2],
    } = await client.query("select * from app_public.make_email_primary($1)", [
      email.id,
    ]);
    expect(email2.id).toBe(email.id);
    expect(email2.is_verified).toBe(true);
    expect(email2.is_primary).toBe(true);
  }));

it("cannot promote a non-verified email to primary", () =>
  withUserDb(async client => {
    const email = await addEmail(client, "newemail@example.com");
    expect(email.is_verified).toBe(false);
    expect(email.is_primary).toBe(false);
    const promise = client.query(
      "select * from app_public.make_email_primary($1)",
      [email.id]
    );
    await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
      `"You may not make an unverified email primary"`
    );
    await expect(promise).rejects.toMatchObject({ code: "VRIFY" });
  }));

it("cannot see other user's emails (verified or otherwise)", () =>
  withRootDb(async client => {
    const [user, user2] = await createUsers(client, 2, true);
    await becomeUser(client, user);
    // Block-scoped variables FTW
    {
      const { rows } = await client.query(
        "select * from app_public.user_emails"
      );
      const userIds = rows
        .map(row => row.user_id)
        .filter(uid => uid !== user.id);
      expect(userIds).toHaveLength(0);
    }

    // And just to check that our test is valid
    await asRoot(client, async () => {
      const { rows } = await client.query(
        "select * from app_public.user_emails"
      );
      const userIds = rows
        .map(row => row.user_id)
        .filter(uid => uid !== user.id);
      expect(userIds.length).toBeGreaterThan(0);
      expect(userIds[0]).toBe(user2.id);
    });
  }));
