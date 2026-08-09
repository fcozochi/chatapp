/**
 * ChatApp Subscription Screen
 * Professional UI with launch pricing: $3.99/mo, $25/yr, 14-day trial
 */

import React, { useState, useEffect } from 'react';

const SubscriptionScreen = ({ onClose, onUpgrade }) => {
    const [selectedInterval, setSelectedInterval] = useState('yearly');
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const response = await fetch('/api/subscription/plans');
            const data = await response.json();
            setPlans(data.plans[0]);
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        }
    };

    const getPrice = () => {
        if (!plans) return '--';
        return selectedInterval === 'monthly' 
            ? `$${plans.monthlyPrice}` 
            : `$${plans.yearlyPrice}`;
    };

    const getIntervalLabel = () => {
        return selectedInterval === 'monthly' ? '/month' : '/year';
    };

    const getSavings = () => {
        if (selectedInterval === 'yearly' && plans) {
            const monthlyTotal = plans.monthlyPrice * 12;
            const savings = ((monthlyTotal - plans.yearlyPrice) / monthlyTotal * 100).toFixed(0);
            return `Save ${savings}%`;
        }
        return null;
    };

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/subscription/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: 'premium',
                    interval: selectedInterval
                })
            });
            const data = await response.json();
            if (data.success) {
                onUpgrade(data);
            }
        } catch (error) {
            console.error('Upgrade failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="subscription-screen">
            <div className="subscription-container">
                {/* Header */}
                <div className="subscription-header">
                    <button className="close-btn" onClick={onClose}>✕</button>
                    <div className="header-content">
                        <div className="header-icon">🚀</div>
                        <h1>Upgrade to Premium</h1>
                        <p>Unlock all premium features</p>
                    </div>
                </div>

                {/* Trial Badge */}
                <div className="trial-badge">
                    <span className="badge-icon">🎁</span>
                    <span>14-day free trial on all plans</span>
                </div>

                {/* Billing Toggle */}
                <div className="billing-toggle">
                    <button 
                        className={`toggle-btn ${selectedInterval === 'monthly' ? 'active' : ''}`}
                        onClick={() => setSelectedInterval('monthly')}
                    >
                        Monthly
                    </button>
                    <button 
                        className={`toggle-btn ${selectedInterval === 'yearly' ? 'active' : ''}`}
                        onClick={() => setSelectedInterval('yearly')}
                    >
                        Yearly
                        {getSavings() && (
                            <span className="savings-badge">{getSavings()}</span>
                        )}
                    </button>
                </div>

                {/* Plan Card */}
                <div className="plan-card">
                    <div className="plan-header">
                        <h2>{plans?.name || 'Premium'}</h2>
                        <div className="plan-price">
                            <span className="price">{getPrice()}</span>
                            <span className="interval">{getIntervalLabel()}</span>
                        </div>
                        <p className="plan-description">{plans?.description}</p>
                    </div>

                    {/* Features */}
                    <div className="plan-features">
                        {plans?.features.map((feature, index) => (
                            <div key={index} className="feature-item">
                                <span className="feature-icon">✓</span>
                                <span className="feature-text">{feature}</span>
                            </div>
                        ))}
                    </div>

                    {/* Upgrade Button */}
                    <button 
                        className="upgrade-btn"
                        onClick={handleUpgrade}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="spinner"></span>
                        ) : (
                            'Start 14-Day Free Trial →'
                        )}
                    </button>

                    {/* Terms */}
                    <p className="terms-text">
                        Cancel anytime • No long-term commitment • Secure payment
                    </p>
                </div>

                {/* Footer */}
                <div className="subscription-footer">
                    <button className="restore-btn" onClick={onClose}>
                        Restore Purchase
                    </button>
                    <a href="/privacy" className="privacy-link">Privacy Policy</a>
                    <a href="/terms" className="terms-link">Terms of Service</a>
                </div>
            </div>

            <style jsx>{`
                .subscription-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .subscription-container {
                    background: #ffffff;
                    border-radius: 24px;
                    max-width: 480px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 24px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                }

                .subscription-header {
                    position: relative;
                    text-align: center;
                    margin-bottom: 20px;
                }

                .close-btn {
                    position: absolute;
                    top: 0;
                    right: 0;
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: #999;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 8px;
                    transition: background 0.3s;
                }

                .close-btn:hover {
                    background: #f0f0f0;
                }

                .header-icon {
                    font-size: 48px;
                    margin-bottom: 8px;
                }

                .header-content h1 {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1a1a2e;
                    margin: 0;
                }

                .header-content p {
                    color: #666;
                    font-size: 16px;
                    margin: 4px 0 0;
                }

                .trial-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 20px;
                }

                .badge-icon {
                    font-size: 20px;
                }

                .billing-toggle {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 24px;
                    background: #f0f2f5;
                    padding: 4px;
                    border-radius: 12px;
                }

                .toggle-btn {
                    flex: 1;
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 14px;
                    color: #666;
                    cursor: pointer;
                    transition: all 0.3s;
                    position: relative;
                }

                .toggle-btn.active {
                    background: white;
                    color: #667eea;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
                }

                .toggle-btn:hover:not(.active) {
                    color: #333;
                }

                .savings-badge {
                    background: #10b981;
                    color: white;
                    padding: 2px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    margin-left: 6px;
                    font-weight: 600;
                }

                .plan-card {
                    background: #f8f9fa;
                    border-radius: 16px;
                    padding: 24px;
                    border: 2px solid transparent;
                    transition: all 0.3s;
                }

                .plan-card:hover {
                    border-color: #667eea;
                }

                .plan-header {
                    text-align: center;
                    margin-bottom: 20px;
                }

                .plan-header h2 {
                    font-size: 20px;
                    color: #1a1a2e;
                    margin: 0 0 4px;
                }

                .plan-price {
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 4px;
                    margin: 8px 0;
                }

                .price {
                    font-size: 36px;
                    font-weight: 700;
                    color: #1a1a2e;
                }

                .interval {
                    font-size: 16px;
                    color: #666;
                }

                .plan-description {
                    color: #888;
                    font-size: 14px;
                    margin: 0;
                }

                .plan-features {
                    margin: 20px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .feature-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 12px;
                    background: white;
                    border-radius: 8px;
                }

                .feature-icon {
                    color: #10b981;
                    font-weight: 700;
                    font-size: 16px;
                    width: 24px;
                }

                .feature-text {
                    color: #333;
                    font-size: 14px;
                }

                .upgrade-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .upgrade-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                }

                .upgrade-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .terms-text {
                    text-align: center;
                    color: #999;
                    font-size: 12px;
                    margin: 12px 0 0;
                }

                .subscription-footer {
                    display: flex;
                    justify-content: center;
                    gap: 16px;
                    margin-top: 16px;
                    flex-wrap: wrap;
                }

                .restore-btn {
                    background: none;
                    border: none;
                    color: #667eea;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: 500;
                }

                .restore-btn:hover {
                    text-decoration: underline;
                }

                .privacy-link,
                .terms-link {
                    color: #999;
                    font-size: 13px;
                    text-decoration: none;
                }

                .privacy-link:hover,
                .terms-link:hover {
                    color: #667eea;
                    text-decoration: underline;
                }

                @media (max-width: 600px) {
                    .subscription-container {
                        padding: 16px;
                    }

                    .header-content h1 {
                        font-size: 24px;
                    }

                    .price {
                        font-size: 30px;
                    }

                    .plan-card {
                        padding: 16px;
                    }
                }
            `}</style>
        </div>
    );
};

export default SubscriptionScreen;