(Live Agent) Basketball AI Ref, an agent-powered multi-angle referee. This is a Live Review Room, in which agents analyze various angles of a single play to determine a verdict and highlight supporting and dissenting clips to the user in an interruptible referee-like manner. 

## Backend Deploy Env

Use `deploy/backend.env.yaml` for Cloud Run env settings (including CORS and Secret Manager metadata), then apply with:

```bash
gcloud run services update bball-ai-ref-agents \
  --region=<region> \
  --project=<project-id> \
  --env-vars-file=deploy/backend.env.yaml
```

For local backend development, copy values from `backend/.env.example`.
