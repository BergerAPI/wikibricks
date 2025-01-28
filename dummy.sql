-- Insert a brand entity and its first version
INSERT INTO
    entities (name, type)
VALUES
    ('LEGO', 'brand');

WITH
    entity_version AS (
        INSERT INTO
            entity_versions (entity_id, version_number, description)
        SELECT
            id,
            1,
            'The LEGO Group is a Danish toy manufacturer.'
        FROM
            entities
        WHERE
            name = 'LEGO' RETURNING id
    )
INSERT INTO
    brands (version_id, country, website)
SELECT
    id,
    'Denmark',
    'www.lego.com'
FROM
    entity_version;
