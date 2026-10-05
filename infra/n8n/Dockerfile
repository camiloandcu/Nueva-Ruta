FROM n8nio/n8n:2.41.3

COPY --chown=node:node infra/n8n/workflows /opt/n8n/workflows

CMD ["/bin/sh", "-c", "n8n import:workflow --input=/opt/n8n/workflows --separate && n8n update:workflow --all --active=true && exec n8n start"]
