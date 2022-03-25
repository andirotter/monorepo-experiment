import { ApolloError } from "@apollo/client";
import { Button, Result } from "antd";
import Paragraph from "antd/lib/typography/Paragraph";
import React from "react";
import { Alert, Button } from "react-bootstrap";

export interface ErrorAlertProps {
  error: ApolloError | Error;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const code: string | undefined = (error as any)?.networkError?.result
    ?.errors?.[0]?.code;
  if (code === "EBADCSRFTOKEN") {
    return (
      <Alert variant="error">
        <Alert.Heading>403 - Invalid CSRF Token</Alert.Heading>
        <p>
          {error.message}
        </p>
        <h2>
          Raw content:
        </h2>
        <p>
          {console.error(error)}
        </p>
        <hr />
        <p className="mb-0">
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </Button>
        </p>
      </Alert>
    );
  }
  return (
    <Alert variant="error">
      <Alert.Heading>Unexpected error</Alert.Heading>
      <p>
        {error.message}
      </p>
      <h2>
        Raw content:
      </h2>
      <p>
        {console.error(error)}
      </p>
      <hr />
      <p className="mb-0">
        Please <a href="/">return to the homepage</a> and try again.
      </p>
    </Alert>
  );
}
