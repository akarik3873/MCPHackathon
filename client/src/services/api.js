const API_URL = import.meta.env.VITE_API_URL;

export async function estimateCost(file, numCalls) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('num_calls', numCalls);

  const response = await fetch(`${API_URL}/analyze/estimate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to estimate cost');
  }

  return response.json();
}

export function startAnalysis(file, prompt, numCalls, userId, onEvent) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', prompt);
    formData.append('num_calls', numCalls);
    formData.append('user_id', userId);

    fetch(`${API_URL}/analyze/stream`, {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.error || 'Analysis failed');
          });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              resolve();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let eventType = null;
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data) {
                  try {
                    onEvent(eventType || 'message', JSON.parse(data));
                  } catch (e) {
                    // skip malformed JSON
                  }
                }
                eventType = null;
              }
            }

            read();
          });
        }

        read();
      })
      .catch(reject);
  });
}
