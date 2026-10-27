import { Request, Response } from 'express';

export function getHome(_req: Request, res: Response): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auth Service</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --primary: #2f81f7;
      --primary-hover: #388bfd;
      --btn-bg: #21262d;
      --btn-border: #363b42;
      --btn-hover: #30363d;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 560px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }
    .description {
      color: var(--text-muted);
      font-size: 1.05rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    @media (min-width: 480px) {
      .buttons {
        flex-direction: row;
        justify-content: center;
      }
    }
    .btn {
      display: inline-block;
      text-decoration: none;
      padding: 0.7rem 1.25rem;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 6px;
      transition: background-color 0.2s, border-color 0.2s;
    }
    .btn-primary {
      background-color: var(--primary);
      color: #ffffff;
      border: 1px solid var(--primary);
    }
    .btn-primary:hover {
      background-color: var(--primary-hover);
    }
    .btn-secondary {
      background-color: var(--btn-bg);
      color: var(--text);
      border: 1px solid var(--btn-border);
    }
    .btn-secondary:hover {
      background-color: var(--btn-hover);
      border-color: var(--border);
    }
    .note {
      font-size: 0.85rem;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Auth Service</h1>
    <p class="description">
      JWT authentication with refresh token rotation, RBAC,<br>
      rate limiting and audit logs.
    </p>
    <div class="buttons">
      <a href="/docs" class="btn btn-primary">API Docs (Swagger)</a>
      <a href="/health" class="btn btn-secondary">Health</a>
      <a href="https://github.com/trooper108/Auth-Service" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Source on GitHub</a>
    </div>
    <p class="note">
      Free instance, the first request after idle can take up to 50 seconds.
    </p>
  </main>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
