/**
 * Subscription Settings Screen
 */

import React from 'react';

const SubscriptionSettings = ({ onClose, onCancel }) => {
    return (
        <div className="settings-screen">
            <div className="settings-container">
                <div className="settings-header">
                    <h2>Subscription Settings</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    <div className="plan-details">
                        <div className="plan-icon">⭐</div>
                        <div className="plan-info">
                            <h3>Premium Plan</h3>
                            <p>$3.99/month • $25/year</p>
                            <span className="status-badge active">Active</span>
                        </div>
                    </div>

                    <div className="settings-list">
                        <div className="setting-item">
                            <span className="setting-label">Renewal Date</span>
                            <span className="setting-value">Aug 23, 2026</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">Payment Method</span>
                            <span className="setting-value">•••• 4242</span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">Plan</span>
                            <span className="setting-value">Yearly</span>
                        </div>
                    </div>

                    <button className="cancel-btn" onClick={onCancel}>
                        Cancel Subscription
                    </button>

                    <p className="cancel-note">
                        Your subscription will remain active until the end of the billing period.
                    </p>
                </div>
            </div>

            <style jsx>{`
                .settings-screen {
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

                .settings-container {
                    background: #ffffff;
                    border-radius: 24px;
                    max-width: 400px;
                    width: 100%;
                    padding: 24px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .settings-header h2 {
                    font-size: 20px;
                    color: #1a1a2e;
                    margin: 0;
                }

                .close-btn {
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

                .plan-details {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 12px;
                    margin-bottom: 20px;
                }

                .plan-icon {
                    font-size: 36px;
                }

                .plan-info h3 {
                    margin: 0;
                    color: #1a1a2e;
                }

                .plan-info p {
                    margin: 4px 0;
                    color: #666;
                    font-size: 14px;
                }

                .status-badge {
                    display: inline-block;
                    padding: 2px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .status-badge.active {
                    background: #d1fae5;
                    color: #065f46;
                }

                .settings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .setting-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }

                .setting-label {
                    color: #666;
                    font-size: 14px;
                }

                .setting-value {
                    color: #1a1a2e;
                    font-weight: 500;
                    font-size: 14px;
                }

                .cancel-btn {
                    width: 100%;
                    padding: 12px;
                    background: #fee;
                    color: #c62828;
                    border: 2px solid #c62828;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .cancel-btn:hover {
                    background: #fdd;
                }

                .cancel-note {
                    text-align: center;
                    color: #999;
                    font-size: 12px;
                    margin: 12px 0 0;
                }
            `}</style>
        </div>
    );
};

export default SubscriptionSettings;