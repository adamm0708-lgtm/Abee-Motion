# Bang Motion Studio Renderer

Deploy this folder as a separate Railway service. Set the Railway service Root Directory to `/renderer`.

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RENDER_SECRET` (a long random secret used by the API to authorize render jobs)
- `RENDER_BUCKET` (optional, defaults to `motion-renders`)

Create a **public** Supabase Storage bucket named `motion-renders` before testing downloads. Keep the service private by only calling it from the backend with the `x-render-secret` header.

The initial renderer supports text, circle shapes, still images, keyframe position/scale/rotation/opacity, layer start/end, and multiple audio layers. It renders at 30 fps. Animated GIF image layers are treated as still images in this first version. Test with a short project before using long timelines.
