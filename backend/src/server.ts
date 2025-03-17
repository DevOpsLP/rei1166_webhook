// src/server.ts
import express from 'express';
import { all, initializeDB, queryAll } from './db';
import { processAlert } from './utils/alertProcessor';
import { saveCredential, getCredentials, updateCredential, deleteCredential } from './models/credentials';
import cors from 'cors';
import { getCurrentTrades, getMaxTrades, registerSSEClient, setCurrentTrades, setMaxTrades } from './models/settings';
import { getUSDMClient, initializeWebSocket, isWebSocketConnected } from './utils/websocketManager';
import { FuturesAccountBalance } from 'binance';
import { Trade } from './models/trades';
import { getTestMode, setTestMode } from './settings';
const app = express();
app.use(cors())
app.use(express.json());

// Initialize the database and start the server
initializeDB()
  .then(() => {
    console.log('Database initialized');
    const PORT = process.env.PORT || 3001;
    initializeWebSocket()
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error initializing DB', err);
  });

// Webhook endpoint: Process incoming alerts
app.post('/webhook', async (req, res) => {
  try {
    const alertData = req.body;

    // Get current trades and max allowed trades
    const [currentTrades, maxTrades] = await Promise.all([
      getCurrentTrades(),
      getMaxTrades(),
    ]);

    // Check if max trades limit is reached
    if (currentTrades >= maxTrades) {
      res.status(200).json({ 
        success: false, 
        message: "Max trades reached, try later" 
      });
      return
    }

    // Process the alert
    await processAlert(alertData);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});
// Endpoint to save Binance API credentials and settings
// In src/server.ts
app.post('/credentials', async (req, res) => {
  try {
    const { apiKey, apiSecret, balance, leverage } = req.body;
    // Convert balance and leverage to numbers if they come as strings
    const id = await saveCredential({
      api_key: apiKey,
      api_secret: apiSecret,
      trade_amount: Number(balance),
      leverage: Number(leverage)
    });
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('Error saving credentials:', err);
    res.status(500).json({ error: 'Error saving credentials' });
  }
});

// Endpoint to retrieve stored credentials (for monitoring)
app.get('/credentials', async (req, res) => {
  try {
    const creds = await getCredentials();
    res.status(200).json({ success: true, data: creds });
  } catch (err) {
    console.error('Error retrieving credentials:', err);
    res.status(500).json({ error: 'Error retrieving credentials' });
  }
});

app.put('/credentials', async (req, res) => {
  try {
    const { apiKey, apiSecret, balance, leverage } = req.body;
    // Use the id from the query parameter, or fallback to the payload
    const id = req.query.id || req.body.id;
    if (!id) {
      res.status(400).json({ error: 'Credential id is required' });
      return
    }
    await updateCredential({
      id: Number(id),
      api_key: apiKey,
      api_secret: apiSecret,
      trade_amount: Number(balance),
      leverage: Number(leverage)
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error updating credentials:', err);
    res.status(500).json({ error: 'Error updating credentials' });
  }
});

// Endpoint to delete credentials
app.delete('/credentials', async (req, res) => {
  try {
    // Here we assume that the credential id is passed as a query parameter (?id=...)
    const { id } = req.query;
    if (!id) {
      res.status(400).json({ error: 'Credential id is required' });
      return
    }
    await deleteCredential(Number(id));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting credentials:', err);
    res.status(500).json({ error: 'Error deleting credentials' });
  }
});

// Endpoint to set max allowed trades
app.post('/settings/max-trades', async (req, res) => {
  try {
    const { maxTrades } = req.body;
    if (maxTrades == null || isNaN(maxTrades)) {
      res.status(400).json({ error: 'maxTrades must be a valid number' });
      return
    }
    await setMaxTrades(Number(maxTrades));
    res.status(200).json({ success: true, maxTrades });
  } catch (err) {
    console.error('Error setting max trades:', err);
    res.status(500).json({ error: 'Error setting max trades' });
  }
});

// Endpoint to get current max allowed trades
app.get('/settings/max-trades', async (req, res) => {
  try {
    const maxTrades = await getMaxTrades();
    res.status(200).json({ success: true, maxTrades });
  } catch (err) {
    console.error('Error retrieving max trades:', err);
    res.status(500).json({ error: 'Error retrieving max trades' });
  }
});

// Get current trade count
app.get('/settings/current-trades', async (req, res) => {
  try {
    const currentTrades = await getCurrentTrades();
    res.status(200).json({ success: true, currentTrades });
  } catch (err) {
    console.error('Error retrieving current trades:', err);
    res.status(500).json({ error: 'Error retrieving current trades' });
  }
});

// Set a specific trade count
app.post('/settings/current-trades', async (req, res) => {
  try {
    const { currentTrades } = req.body;
    if (currentTrades == null || isNaN(currentTrades)) {
      res.status(400).json({ error: 'currentTrades must be a valid number' });
      return
    }
    await setCurrentTrades(Number(currentTrades));
    res.status(200).json({ success: true, currentTrades });
  } catch (err) {
    console.error('Error setting current trades:', err);
    res.status(500).json({ error: 'Error setting current trades' });
  }
});

// Endpoint to check WebSocket connection status
app.get('/server/status', (req, res) => {
  const connected = isWebSocketConnected();
  res.json({ success: true, connected });
});

// Endpoint to manually trigger WebSocket connection
app.post('/server/connect', async (req, res) => {
  const ws = await initializeWebSocket();
  if (ws) {
      res.json({ success: true, message: 'WebSocket connected successfully' });
  } else {
      res.status(500).json({ success: false, message: 'Failed to initialize WebSocket' });
  }
});

// New Endpoint to Fetch Binance Futures Balance
app.get("/server/balance", async (req, res) => {
  try {
    const client = getUSDMClient();
    if (!client) {
       res.status(500).json({ success: false, message: "WebSocket is not initialized" });
       return
    }

    // Fetch all account balances
    const accountInfo: FuturesAccountBalance[] = await client.getBalanceV3();

    // Filter to get only USDT balance
    const usdtBalance = accountInfo.find((item) => item.asset === "USDT");

    // If USDT balance is not found,  an error response
    if (!usdtBalance) {
       res.status(404).json({ success: false, message: "USDT balance not found" });
       return
    }

    // Format response
    const formattedBalance = {
      asset: usdtBalance.asset,
      balance: usdtBalance.balance,
      availableBalance: usdtBalance.availableBalance,
      crossWalletBalance: usdtBalance.crossWalletBalance,
      crossUnPnl: usdtBalance.crossUnPnl, // Unrealized PnL
      maxWithdrawAmount: usdtBalance.maxWithdrawAmount,
      marginAvailable: usdtBalance.marginAvailable,
      updateTime: usdtBalance.updateTime
    };

    res.status(200).json({ success: true, balance: formattedBalance });
  } catch (err) {
    console.error("Error fetching balance:", err);
    res.status(500).json({ error: "Error fetching balance" });
  }
});

// Endpoint to get test mode status
app.get('/settings/test-mode', (req, res) => {
  res.status(200).json({ success: true, testMode: getTestMode() });
});

// Endpoint to update test mode status
app.post('/settings/test-mode', (req, res) => {
  try {
    const { testMode } = req.body;
    if (typeof testMode !== 'boolean') {
       res.status(400).json({ error: 'testMode must be a boolean (true or false)' });
       return
    }

    setTestMode(testMode);
    res.status(200).json({ success: true, testMode });
  } catch (err) {
    console.error('Error setting test mode:', err);
    res.status(500).json({ error: 'Error setting test mode' });
  }
});

app.get("/all-trades", async (req, res) => {
  try {
    const { days } = req.query;
    const validDays = [1, 7, 30];
    const daysInt = Number(days) || 1;

    if (!validDays.includes(daysInt)) {
       res.status(400).json({ success: false, message: "Invalid 'days' parameter. Use 1, 7, or 30." });
       return
    }

    // Get current timestamp and calculate start time
    const endTime = Date.now();
    const startTime = endTime - daysInt * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    // Fetch trades from the database within the specified time range
    const trades = await queryAll(
      `SELECT * FROM trades WHERE time BETWEEN ? AND ? ORDER BY time DESC`,
      [startTime, endTime]
    ) as Trade[];

     res.status(200).json({ success: true, trades });
  } catch (err) {
    console.error("Error fetching trades from database:", err);
     res.status(500).json({ error: "Error fetching trade history" });
  }
});

app.get("/sse/trades", (req, res) => {
  registerSSEClient(req, res);
});