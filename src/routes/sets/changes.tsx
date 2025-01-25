import { sql, type SetVersion } from "../../database";
import { Layout } from "../../layout";
import { PermissionLevel, type DefaultContext } from "../../utils";

type SetVersionMetaData = SetVersion & {
    set_name: string;
    username: string;
    old_value: string;
};

const DiffDisplay = ({ oldValue, newValue }: { oldValue: any; newValue: any }) => {
    const diffItems = [];

    if (!oldValue) {
        diffItems.push(<div class="text-green-600">New set created</div>);
    }

    for (const [key, value] of Object.entries(newValue)) {
        if (oldValue && oldValue[key] === value) continue;

        diffItems.push(
            <div key={key}>
                <strong>{key}:</strong>{' '}
                {oldValue && <span class="text-red-600">{oldValue[key]} → </span>}
                <span class="text-green-600">{value}</span>
            </div>
        );
    }

    return <>{diffItems}</>;
};

const ActionButtons = ({ changeId }: { changeId: string }) => (
    <td class="space-x-2">
        <form class="inline" method="post" action={`/sets/changes/${changeId}`}>
            <input type="hidden" name="type" value="accept" />
            <button class="px-2 py-1 bg-green-500 text-white rounded" type="submit">Accept</button>
        </form>
        <form class="inline" method="post" action={`/sets/changes/${changeId}`}>
            <input type="hidden" name="type" value="decline" />
            <button class="px-2 py-1 bg-red-500 text-white rounded" type="submit">Decline</button>
        </form>
    </td>
);

const ChangeTable = ({ changes }: { changes: SetVersionMetaData[] }) => (
    <table class="table-auto w-full mt-4 border-collapse border">
        <thead>
            <tr class="[&>th]:border bg-background">
                <th>Set</th>
                <th>Changed By</th>
                <th>Diff</th>
                <th>Date</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            {changes.map(change => {
                const oldValue = change.old_value ? JSON.parse(change.old_value) : null;
                const newValue = JSON.parse(change.value);

                return (
                    <tr class="[&>td]:border [&>td]:p-1" key={change.version_id}>
                        <td>{change.set_name}</td>
                        <td>{change.username}</td>
                        <td>
                            <DiffDisplay oldValue={oldValue} newValue={newValue} />
                        </td>
                        <td>{new Date(change.created_at).toLocaleString()}</td>
                        <ActionButtons changeId={change.version_id} />
                    </tr>
                );
            })}
        </tbody>
    </table>
);

async function handleSetUpdate(change: SetVersion) {
    const newValue = JSON.parse(change.value);

    if (change.previous_version === null) {
        await sql`
            INSERT INTO sets (name, brand_id, pieces, description)
            VALUES (${newValue.name}, ${newValue.brand_id}, ${newValue.pieces}, ${newValue.description})
        `;
    } else {
        await sql`
            UPDATE sets 
            SET name = ${newValue.name},
                brand_id = ${newValue.brand_id},
                pieces = ${newValue.pieces},
                description = ${newValue.description}
            WHERE id = ${change.set_id}
        `;
    }
}

export const handleSetChangesPage = async (c: DefaultContext) => {
    const user = c.get("user");

    if (!user || user.permission_level < PermissionLevel.MODERATOR) {
        return c.redirect("/sets");
    }

    const changes = await sql<SetVersionMetaData[]>`
        SELECT 
            sv.*, sov.value as old_value,
            s.name as set_name,
            u.username as username
        FROM set_versions sv
        JOIN users u ON sv.edited_by = u.id
        LEFT JOIN sets s ON sv.set_id = s.id
        LEFT JOIN set_versions sov ON sv.previous_version = sov.version_id
        WHERE sv.approval_status = 'pending'
        ORDER BY sv.created_at DESC
    `;

    console.log(changes)

    return c.render(
        <Layout user={user}>
            <main>
                <h1 class="text-3xl font-serif pb-2 mb-3 border-b">Set Changes</h1>
                <div class="min-w-full overflow-x-auto">
                    <ChangeTable changes={changes} />
                </div>
            </main>
        </Layout>
    );
}

export const handleChangeSubmit = async (c: DefaultContext) => {
    const user = c.get("user");
    if (!user || user.permission_level < PermissionLevel.MODERATOR) {
        return c.redirect("/sets");
    }

    const changeId = c.req.param("id");
    const { type } = await c.req.parseBody();
    const [change] = await sql<SetVersion[]>`SELECT * FROM set_versions WHERE version_id = ${changeId}`;

    if (!["accept", "decline"].includes(type.toString()) || !changeId || !change) {
        return c.redirect("/sets/changes");
    }

    if (type === "accept") {
        await handleSetUpdate(change);
        await sql`UPDATE set_versions SET approval_status = 'accepted' WHERE version_id = ${changeId}`;
    } else
        await sql`UPDATE set_versions SET approval_status = 'declined' WHERE version_id = ${changeId}`;

    return c.redirect("/sets/changes");
}