import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole, type SessionUser } from "@/lib/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormMessage,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui-client";
import { changeUserRole, deleteUser, toggleUserActive } from "./actions";

type Props = {
  searchParams: Promise<{ message?: string; tone?: string }>;
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AccessDenied() {
  return (
    <div className="space-y-4">
      <PageHeader title="Users & Staff" />
      <Alert tone="danger">
        Access denied. Only owners can manage users and staff.
      </Alert>
    </div>
  );
}

export default async function UsersPage({ searchParams }: Props) {
  let session: SessionUser;
  try {
    session = await requireRole("OWNER");
  } catch {
    return <AccessDenied />;
  }

  const { message, tone } = await searchParams;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.shopId, session.shopId))
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & Staff"
        subtitle="Manage who can access this shop. Staff accounts cannot open this page."
        actions={
          <LinkButton href="/users/new" size="sm">
            + Add User
          </LinkButton>
        }
      />

      <FormMessage message={message} tone={tone} />

      <Card>
        <CardHeader
          title="Team members"
          subtitle={`${rows.length} account${rows.length === 1 ? "" : "s"}`}
        />
        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No users yet"
              message="Add your first team member to get started."
              action={
                <LinkButton href="/users/new" size="sm">
                  + Add User
                </LinkButton>
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = u.id === session.id;
                return (
                  <tr key={u.id}>
                    <Td className="font-medium">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          (you)
                        </span>
                      )}
                    </Td>
                    <Td className="text-slate-600">{u.email}</Td>
                    <Td>
                      <Badge tone={u.role === "OWNER" ? "info" : "default"}>
                        {u.role}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={u.active ? "success" : "default"}>
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {formatDate(u.createdAt)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle active */}
                        <form action={toggleUserActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "You cannot change your own status"
                                : u.active
                                  ? "Deactivate this user"
                                  : "Reactivate this user"
                            }
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                        {/* Role change */}
                        {!isSelf && (
                          <form
                            action={changeUserRole}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={u.id} />
                            <Select
                              name="role"
                              defaultValue={u.role}
                              aria-label={`Role for ${u.name}`}
                              className="h-8 w-auto px-2 text-sm"
                            >
                              <option value="STAFF">STAFF</option>
                              <option value="OWNER">OWNER</option>
                            </Select>
                            <Button type="submit" size="sm" variant="ghost">
                              Save
                            </Button>
                          </form>
                        )}
                        {/* Delete */}
                        {isSelf ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled
                            title="You cannot delete your own account"
                          >
                            Delete
                          </Button>
                        ) : (
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <ConfirmSubmit
                              message={`Delete user "${u.name}" (${u.email})? This cannot be undone.`}
                            >
                              Delete
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
