# Onboarding

The app becomes account-first with a staged flow: authenticate, settle webcam
consent once, land in a group, then play. Anonymous quick-play is removed.

## Mutual Understanding

Agreed in conversation on 2026-07-23.

- On load, a modal offers sign in or sign up: email + password, or Google.
  Email sign-up uses a larger intake form (display name, email, password,
  confirm password). Values persist to the player's server-side profile.
- After authentication, the only prompt is webcam consent with a blurb
  explaining why the game wants the camera. "No thanks" is persisted on the
  profile and respected on every future login; those players appear as
  initial-letter bubbles.
- Next, the player creates a group or picks one from the list of groups they
  already belong to.
- Only with an active group do the invite link, run history, and play button
  appear. Play auto-joins the group's shared room (derived from the group
  id) so groupmates land in the same arena; manual room codes are gone.

## Onboarding Flow

```mermaid
stateDiagram-v2
    [*] --> Auth: no valid session
    [*] --> Consent: session restored,\nconsent unanswered
    [*] --> Grouping: session restored,\nconsent answered
    Auth --> Consent: signed in / up\n(email or Google)
    Consent --> Grouping: allow or decline\n(persisted once)
    Grouping --> Ready: created or picked\na group
    Ready --> Playing: play button\n(group room auto-join)
    Playing --> Ready: run over

    classDef gate fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef once fill:#fde68a,stroke:#b45309,color:#78350f
    classDef social fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef go fill:#bbf7d0,stroke:#15803d,color:#14532d
    class Auth gate
    class Consent once
    class Grouping social
    class Ready,Playing go
```

## Auth Paths

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    participant G as Google

    rect rgb(253, 230, 138)
    Note over B,S: Email path
    B->>S: POST /api/auth/signup {name, email, password}
    S->>S: scrypt hash, create profile
    S-->>B: { token (our session JWT), profile }
    end

    rect rgb(191, 219, 254)
    Note over B,G: Google path
    B->>G: Google Identity Services button
    G-->>B: Google ID token
    B->>S: POST /api/auth/google {idToken}
    S->>G: verify against JWKS
    S->>S: upsert profile
    S-->>B: { token (our session JWT), profile }
    end

    Note over B,S: Both paths converge: one session token,\nused for the API and the game socket alike
```

Both auth paths converge on a server-minted session token, so the rest of
the app (REST API, websocket join, run recording) has exactly one credential
type to verify.
