FROM n8nio/n8n:2.41.3

COPY --chown=node:node infra/n8n/workflows /opt/n8n/workflows
COPY --chown=node:node infra/n8n/start.js /opt/n8n/start.js

ENTRYPOINT ["tini", "--", "/usr/local/bin/node", "/opt/n8n/start.js"]
