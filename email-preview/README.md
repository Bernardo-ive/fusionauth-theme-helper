# email-preview

Local email template preview service.

This service renders the email template *locally* (no FusionAuth API call) to give quick feedback on:

* HTML output
* Text output
* Missing variables / broken placeholders (basic checks)

Note: This is not a full FreeMarker engine. It uses a lightweight `${...}` interpolator with a sample context.
Use FusionAuth preview for authoritative FreeMarker evaluation.

## Run

```sh
pnpm email:preview
```

Open http://localhost:4560

## API

* `POST /api/render`

Body:

```json
{
  "html": "<p>Hello ${user.firstName!'there'}</p>",
  "text": "Hello ${user.firstName!'there'}",
  "context": {"user": {"firstName": "Pat"}},
  "strict": false
}
```

Response:

```json
{
  "html": "<p>Hello Pat</p>",
  "text": "Hello Pat",
  "unresolved": ["user.lastName"],
  "warnings": []
}
```
