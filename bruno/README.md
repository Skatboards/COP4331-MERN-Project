# Bruno collection

API requests for the MERN Project API Role lab, for [Bruno](https://www.usebruno.com/).

| Request | Expected |
| --- | --- |
| Register | `201` with a confirmation message (makes a new `demo########` user each run) |
| Login | `200` with the user record and a token |
| Login - Wrong Password | `401` with an error message |
| Get My Profile | `200`, using the token saved by Login |

## Setup

1. In Bruno, choose **Open Collection** and select this `bruno/` folder.
2. Pick the **Production** (`https://sweeple.natreese.dev`) or **Local** (`http://localhost:5173`) environment.
3. In the environment settings, set `login` to the username or email of an account whose email is verified, and set the secret `password`. Secret values stay on your machine and are not saved in these files.

A newly registered account gets `403 EMAIL_NOT_VERIFIED` from Login until its verification link is opened. Without SMTP configured, the link is printed in `docker compose logs backend`.

## Command line

```bash
npx @usebruno/cli@4.3.0 run --env Local --env-var login=USERNAME --env-var password=PASSWORD
```

Run it from this folder.
