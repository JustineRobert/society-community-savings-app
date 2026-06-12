const axios = require('axios');

const BASE_URL = process.env.MTN_MOMO_BASE_URL;
const API_USER = process.env.MTN_API_USER;
const API_KEY = process.env.MTN_API_KEY;

async function getAccessToken() {
  const res = await axios.post(`${BASE_URL}/collection/token/`, null, {
    headers: {
      Authorization:
        'Basic ' + Buffer.from(API_USER + ':' + API_KEY).toString('base64'),
      'Ocp-Apim-Subscription-Key': process.env.MTN_SUB_KEY,
    },
  });

  return res.data.access_token;
}

module.exports = { getAccessToken };