Place built-in example clips here using these exact filenames:

- `media/examples/example_1/clip_1.mp4`
- `media/examples/example_1/clip_2.mp4`
- `media/examples/example_2/clip_1.mp4`
- `media/examples/example_2/clip_2.mp4`
- `media/examples/example_2/clip_3.mp4`
- `media/examples/example_2/clip_4.mp4`
- `media/examples/example_3/clip_1.mp4`
- `media/examples/example_3/clip_2.mp4`
- `media/examples/example_3/clip_3.mp4`
- `media/examples/example_3/clip_4.mp4`

The backend `POST /api/sessions/from-example/{example_id}` endpoint will return an
error if any required clip file is missing.
