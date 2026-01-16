import { useState, useEffect } from 'react';

export default function Webhooks() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('whsec_test_abc123');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const apiKey = localStorage.getItem('api_key') || 'key_test_abc123';
  const apiSecret = localStorage.getItem('api_secret') || 'secret_test_xyz789';

  useEffect(() => {
    fetchWebhookLogs();
  }, [limit, offset]);

  async function fetchWebhookLogs() {
    try {
      const res = await fetch(
        `http://localhost:8000/api/v1/webhooks?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'X-Api-Key': apiKey,
            'X-Api-Secret': apiSecret
          }
        }
      );

      if (!res.ok) throw new Error('Failed to fetch webhook logs');

      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching webhook logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/v1/webhooks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-Secret': apiSecret
        },
        body: JSON.stringify({ webhook_url: webhookUrl, webhook_secret: webhookSecret })
      });

      if (!res.ok) throw new Error('Failed to save webhook configuration');

      const data = await res.json();

      // Show masked secret if returned
      if (data.webhook_secret) {
        setWebhookSecret(data.webhook_secret);
      }

      alert('Webhook configuration saved');
    } catch (err) {
      console.error('Error saving webhook config:', err);
      alert('Failed to save webhook configuration');
    }
  }

  async function handleRetry(webhookId) {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/webhooks/${webhookId}/retry`, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'X-Api-Secret': apiSecret
        }
      });

      if (!res.ok) throw new Error('Failed to retry webhook');

      alert('Webhook retry scheduled');
      fetchWebhookLogs();
    } catch (err) {
      console.error('Error retrying webhook:', err);
      alert('Failed to retry webhook');
    }
  }

  async function handleTestWebhook(e) {
    e.preventDefault();
    alert('Test webhook sent to ' + webhookUrl);
  }

  return (
    <div data-test-id="webhook-config" style={{ padding: '20px' }}>
      <h2>Webhook Configuration</h2>

      <form data-test-id="webhook-config-form" onSubmit={handleSaveConfig} style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label>Webhook URL</label>
          <input
            data-test-id="webhook-url-input"
            type="url"
            placeholder="https://yoursite.com/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Webhook Secret</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <span
              data-test-id="webhook-secret"
              style={{
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                flex: 1,
                border: '1px solid #ccc',
                fontFamily: 'monospace'
              }}
            >
              {webhookSecret}
            </span>
            <button
              data-test-id="regenerate-secret-button"
              type="button"
              onClick={() => {
                const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15);
                setWebhookSecret(newSecret);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Regenerate
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            data-test-id="save-webhook-button"
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save Configuration
          </button>

          <button
            data-test-id="test-webhook-button"
            type="button"
            onClick={handleTestWebhook}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Send Test Webhook
          </button>
        </div>
      </form>

      <h3>Webhook Logs</h3>

      {loading ? (
        <p>Loading webhook logs...</p>
      ) : logs.length === 0 ? (
        <p>No webhook logs yet</p>
      ) : (
        <>
          <table
            data-test-id="webhook-logs-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '20px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Event</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Attempts</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Last Attempt</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Response Code</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  data-test-id="webhook-log-item"
                  data-webhook-id={log.id}
                  style={{ borderBottom: '1px solid #eee' }}
                >
                  <td data-test-id="webhook-event" style={{ padding: '12px' }}>
                    {log.event}
                  </td>
                  <td
                    data-test-id="webhook-status"
                    style={{
                      padding: '12px',
                      color: log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'orange'
                    }}
                  >
                    {log.status}
                  </td>
                  <td data-test-id="webhook-attempts" style={{ padding: '12px' }}>
                    {log.attempts}
                  </td>
                  <td data-test-id="webhook-last-attempt" style={{ padding: '12px' }}>
                    {log.last_attempt_at
                      ? new Date(log.last_attempt_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td data-test-id="webhook-response-code" style={{ padding: '12px' }}>
                    {log.response_code || '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {log.status === 'failed' && (
                      <button
                        data-test-id="retry-webhook-button"
                        data-webhook-id={log.id}
                        onClick={() => handleRetry(log.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            <div>
              Showing {logs.length} of {total} total logs
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
