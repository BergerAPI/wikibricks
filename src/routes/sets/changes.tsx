import { sql, type SetChange } from "../../database";
import { Layout } from "../../layout";
import { PermissionLevel, type DefaultContext } from "../../utils";

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

const ChangeTable = ({ changes }: { changes: SetChange[] }) => (
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
                const newValue = JSON.parse(change.new_value);

                return (
                    <tr class="[&>td]:border [&>td]:p-1" key={change.id}>
                        <td>{change.set_name}</td>
                        <td>{change.user_name}</td>
                        <td>
                            <DiffDisplay oldValue={oldValue} newValue={newValue} />
                        </td>
                        <td>{new Date(change.created_at).toLocaleString()}</td>
                        <ActionButtons changeId={change.id} />
                    </tr>
                );
            })}
        </tbody>
    </table>
);

async function handleSetUpdate(change: SetChange) {
    const newValue = JSON.parse(change.new_value);

    if (change.old_value === null) {
        await sql`
            INSERT INTO t_set (name, brand_id, pieces, description)
            VALUES (${newValue.name}, ${newValue.brand_id}, ${newValue.pieces}, ${newValue.description})
        `;
    } else {
        await sql`
            UPDATE t_set 
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

    const changes = await sql<SetChange[]>`
        SELECT 
            sc.id, sc.old_value, sc.new_value, sc.created_at,
            sc.set_id, s.name as set_name, u.username as user_name,
            sc.status
        FROM t_set_change sc
        JOIN t_set s ON sc.set_id = s.id
        JOIN t_user u ON sc.user_id = u.id
        WHERE sc.status = 'pending'
        ORDER BY sc.created_at DESC
    `;

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
    const changes = await sql<SetChange[]>`SELECT * FROM t_set_change WHERE id = ${changeId}`;

    if (!["accept", "decline"].includes(type.toString()) || !changeId || changes.length === 0) {
        return c.redirect("/sets/changes");
    }

    const change = changes[0];

    if (type === "accept") {
        await handleSetUpdate(change);
        await sql`UPDATE t_set_change SET status = 'accepted' WHERE id = ${changeId}`;
    } else
        await sql`UPDATE t_set_change SET status = 'declined' WHERE id = ${changeId}`;

    return c.redirect("/sets/changes");
}