## Decisions

### The intake screen is a message composer, not a scenario selector

The composer is the primary control. Optional example buttons only replace its
text so a recording can move quickly; they never restrict what an operator can
enter. Submission preserves the existing authenticated FastAPI path and shows
the persisted result in a compact outcome panel.

### AI remains an assistant inside deterministic guardrails

The API sends only the already-redacted message to the Responses API with a
strict schema. It records provider/model/status metadata. The deterministic
triage result continues to choose ignore/escalate/respond for protected
conditions. If assistance is unavailable, invalid, or unsafe, the existing
fallback and human review path remain in effect.

### Every work surface follows the same hierarchy

1. Orient: page purpose, count and current scope.
2. Choose: an explicit case, filter, or queue item.
3. Act: one primary action and contextual secondary actions.
4. Verify: a state transition/status message and chronological evidence.
5. Investigate: raw identifiers, checksums and diagnostics are hidden behind
   details controls unless necessary.

### CRM separates the case lifecycle from operations infrastructure

The selected lead and its disposition history remain together. Escalations get
a lifecycle panel that exposes only the next valid action. Assignment/closure
is a supervisor-only details section. Transfer delivery, retry, dead-letter and
recovery stay in a separate operations panel.

### Creator content uses independently resilient views

The client requests access, creators, sources and scripts independently. A
failure in one does not blank the other healthy views. The default view is a
summary that directs the reviewer to source priority or pending script review;
catalog detail is on demand rather than rendered as three equally weighted
columns.

## Rollout

1. Add focused API/UI tests for arbitrary intake, assistance metadata,
   escalation action availability and creator partial loading.
2. Apply UI/API changes locally and run quality/build checks.
3. Configure the existing Railway API with the local secret through managed
   variables; never put it in source or logs. Make one harmless test request.
4. Reset the authorized temporary Supabase baseline and redeploy web/API.
5. Verify the hosted route matrix while authenticated as the applicable roles.
