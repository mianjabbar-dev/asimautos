import { requireRole } from "@/lib/auth";
import { Alert, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { NewUserForm } from "./new-user-client";

function AccessDenied() {
  return (
    <div className="space-y-4">
      <PageHeader title="Add User" />
      <Alert tone="danger">
        Access denied. Only owners can add users.
      </Alert>
    </div>
  );
}

export default async function NewUserPage() {
  try {
    await requireRole("OWNER");
  } catch {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Add User"
        subtitle="Create a login for a team member. They will sign in with their email and password."
        actions={
          <LinkButton href="/users" variant="secondary" size="sm">
            ← Back to users
          </LinkButton>
        }
      />
      <Card className="max-w-xl">
        <CardHeader title="New user details" />
        <div className="p-4 sm:p-5">
          <NewUserForm />
        </div>
      </Card>
    </div>
  );
}
