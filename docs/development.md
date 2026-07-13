# Development Setup

## Python

Run the local GUI server:

```bash
uv run glance gui
```

Useful development options:

```bash
uv run glance gui --no-open
uv run glance gui --reload
uv run glance gui -p 0
```

Run checks:

```bash
uv run ruff check .
uv run pytest
```

## Web

Install frontend dependencies:

```bash
cd web
bun install
```

Run the Vite development server:

```bash
bun run dev
```

Run frontend checks:

```bash
bun run test
bun run typecheck
bun run build
```

## Current Development Flow

For now, run the Python server and Vite server separately:

```bash
uv run glance gui --no-open
cd web && bun run dev
```

Open the Vite URL in the browser. The production packaging path will later build `web/dist`
and copy it into `src/glance/web_static/` so normal users only need the Python package.
