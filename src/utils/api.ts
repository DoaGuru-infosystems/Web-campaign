export const API_CALLS = {
  get: async (endpoint: string, serverUrl: string, token?: string) => {
    const res = await fetch(`${serverUrl}/api${endpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      throw new Error(err.error || 'Server error');
    }
    return res.json();
  },

  post: async (endpoint: string, body: any, serverUrl: string, token?: string) => {
    const res = await fetch(`${serverUrl}/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      throw new Error(err.error || 'Server error');
    }
    return res.json();
  },

  put: async (endpoint: string, body: any, serverUrl: string, token?: string) => {
    const res = await fetch(`${serverUrl}/api${endpoint}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      throw new Error(err.error || 'Server error');
    }
    return res.json();
  },

  upload: async (fileUri: string, filename: string, mimeType: string, serverUrl: string, token?: string) => {
    let cleanUri = decodeURIComponent(fileUri);
    if (!cleanUri.startsWith('file://') && !cleanUri.startsWith('content://') && cleanUri.startsWith('/')) {
      cleanUri = `file://${cleanUri}`;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: cleanUri,
      name: filename,
      type: mimeType || 'image/jpeg',
    } as any);

    const res = await fetch(`${serverUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload error');
    }
    return res.json();
  }
};
