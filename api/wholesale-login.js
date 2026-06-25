// Wholesale clients are stored as a JSON array in the WHOLESALE_CLIENTS env var.
// Format: [{"email":"client@co.com","password":"pass123","name":"John","company":"ACME"}]
// Add/remove clients by editing that env var in your Vercel project settings.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let clients = [];
  try {
    clients = JSON.parse(process.env.WHOLESALE_CLIENTS ?? '[]');
  } catch {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const client = clients.find(
    (c) => c.email.toLowerCase() === email.toLowerCase().trim() && c.password === password,
  );

  if (!client) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.status(200).json({
    success: true,
    client: { name: client.name, company: client.company ?? null, email: client.email },
  });
}
