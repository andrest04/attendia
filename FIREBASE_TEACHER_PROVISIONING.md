# Firebase teacher provisioning

Public profile creation creates `student` profiles only. A client request can never create or change a `teacher` role.

Before deploying this policy, provision every legitimate teacher by Firebase UID:

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/serviceAccountKey.json \
  npm run firebase:bootstrap-teacher -- <firebase-uid>
```

The command is administrative and must run from a trusted machine with a Firebase service-account credential. It merges only the teacher provisioning fields, preserving an existing profile's name and email. Do not expose this credential or run the command in browser/client environments.

The local Express service emits JSON `operational_failure` events to its process log for release-critical report, class, and resource failures. Production deployment must collect those logs and configure an alert for that event; this repository does not ship a hosted alerting integration.
