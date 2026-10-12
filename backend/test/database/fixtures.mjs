import { randomUUID } from 'node:crypto';

// TEST ONLY. Fake facts exercise persistence constraints and are never seeded
// into development/demo or described as provider acceptance evidence.
export async function mediaFixture(client, ownerId, status = 'PENDING') {
  const id = randomUUID();
  await client.query(
    `INSERT INTO lumical.media_assets
    (id,owner_id,category,status,upload_intent_id,storage_reference,verified_bytes,content_type,verified_at)
    VALUES ($1,$2,'IMAGE',$3,$4,$5,$6,$7,$8)`,
    [
      id,
      ownerId,
      status,
      randomUUID(),
      status === 'READY' ? `test-only:${id}` : null,
      status === 'READY' ? 42 : null,
      status === 'READY' ? 'image/png' : null,
      status === 'READY' ? new Date() : null,
    ],
  );
  return id;
}

export async function artifactFixture(
  client,
  projectId,
  ownerId,
  status = 'PREPARING',
) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO lumical.ar_target_artifacts
    (id,project_id,owner_id,source_revision,target_id,status,artifact_reference,adapter_metadata,prepared_at)
    VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8)`,
    [
      id,
      projectId,
      ownerId,
      randomUUID(),
      status,
      status === 'READY' ? `test-only:${id}` : null,
      { testOnly: true },
      status === 'READY' ? new Date() : null,
    ],
  );
  return id;
}

export async function projectFixture(client, ownerId, revisionId) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO lumical.calendar_projects
    (id,owner_id,template_revision_id,title,year,recipient_name,baseline_name_vi,baseline_name_en,
    baseline_style,style_preset_id,unit_price_minor,updated_at)
    VALUES ($1,$2,$3,'TEST ONLY',2027,'Synthetic recipient','Mẫu','Synthetic','{}','synthetic-neutral',1450,now())`,
    [id, ownerId, revisionId],
  );
  return id;
}

export async function orderFixture(client, projectId, ownerId) {
  const intentId = randomUUID();
  const id = randomUUID();
  await client.query(
    `INSERT INTO lumical.checkout_intents
    (id,owner_id,project_id,project_revision,request_digest,canonical_request,released_at)
    VALUES ($1,$2,$3,1,'test-digest','{}',now())`,
    [intentId, ownerId, projectId],
  );
  await client.query(
    `INSERT INTO lumical.orders
    (id,owner_id,project_id,checkout_intent_id,quantity,unit_price_minor,total_minor,contact_name,contact_email,updated_at)
    VALUES ($1,$2,$3,$4,2,1450,2900,'Synthetic','synthetic@example.invalid',now())`,
    [id, ownerId, projectId, intentId],
  );
  return id;
}
