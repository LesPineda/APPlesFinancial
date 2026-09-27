async function updateTigo() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/debts/c76cb2d7-73e5-4425-85f4-381f91600078', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'apples_fin_sec_key_2026_x89'
      },
      body: JSON.stringify({
        fecha_limite_pago: '2026-09-25T05:00:00.000Z'
      })
    });
    const data = await res.json();
    console.log('Update API result:', data);
  } catch (err) {
    console.error('API call failed:', err);
  }
}

updateTigo();
