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

## Helpful Links

- [AI Basketball Ref MVP](https://bball-ai-ref-frontend-794727813456.europe-west1.run.app)
- [Gemini API Spend](https://aistudio.google.com/spend?project=gen-lang-client-0033027617)
- [Google Cloud Hub](https://console.cloud.google.com/home/dashboard?project=project-55d10d00-4e1a-4411-beb&pli=1)
- [Google Cloud Build History](https://console.cloud.google.com/cloud-build/builds?project=project-55d10d00-4e1a-4411-beb)
- [Google Cloud Run Services](https://console.cloud.google.com/run/services?project=project-55d10d00-4e1a-4411-beb)
- [Google Cloud Secret Manager](https://console.cloud.google.com/security/secret-manager/secret/bball-ai-ref/versions?project=project-55d10d00-4e1a-4411-beb)
- [Google ADK](https://google.github.io/adk-docs/)
- [Google Gen AI SDK](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)
