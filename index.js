const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// BASIC ROUTES
// ============================================================

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'ChatApp Pro is running!' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// ============================================================
// SUBSCRIPTION ROUTES - LAUNCH PRICING
// $3.99/month, $25/year, 14-day trial
// ============================================================

// Get subscription plans
app.get('/api/subscription/plans', (req, res) => {
    res.json({
        success: true,
        plans: [{
            id: 'premium',
            name: 'ChatApp Premium',
            description: 'Unlock all premium features',
            monthlyPrice: 3.99,
            yearlyPrice: 25.00,
            yearlySavings: '48%',
            features: [
                'Direct Messaging',
                'DM Translation (50+ languages)',
                '1-year data retention',
                'No ads',
                'Priority support',
                'Unlimited DMs'
            ],
            trialDays: 14,
            popular: true
        }],
        trialDays: 14,
        currency: 'USD'
    });
});

// Get pricing for a specific interval
app.get('/api/subscription/pricing/:interval', (req, res) => {
    const { interval } = req.params;
    const prices = {
        monthly: { amount: 3.99, interval: 'monthly' },
        yearly: { amount: 25.00, interval: 'yearly' }
    };
    
    if (!prices[interval]) {
        return res.status(400).json({ error: 'Invalid interval. Use monthly or yearly' });
    }
    
    res.json({
        success: true,
        ...prices[interval],
        currency: 'USD',
        trialDays: 14
    });
});

// Get current subscription status (placeholder)
app.get('/api/subscription/current', (req, res) => {
    res.json({
        success: true,
        subscription: {
            plan: 'free',
            isPremium: false,
            trialDays: 14,
            upgradeUrl: '/subscription'
        }
    });
});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});