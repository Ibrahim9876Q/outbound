# API state additions

- `devices.mic.apps[].id` and `devices.camera.apps[].id` now expose the lowercase Windows executable or package ID for each active app. Match it against `apps[].id` first, then use the existing `app` label for a name match. The fields appear in both `/api/state` and the SSE `state` payload.
