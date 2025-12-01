'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface NotificationSettingsProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
}

type NotificationLevel = 'all' | 'mentions' | 'nothing';

export function NotificationSettings({ channelId, channelName, onClose }: NotificationSettingsProps) {
  const [level, setLevel] = useState<NotificationLevel>('all');
  const [isMuted, setIsMuted] = useState(false);
  const [customSchedule, setCustomSchedule] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string>('');

  function saveSettings() {
    // Static code Backend team please change it to dynamic - PUT /api/channels/:id/notifications
    console.log('Saving notification settings:', { channelId, level, isMuted, muteUntil });
    // Store in localStorage for now
    localStorage.setItem(`notifications_${channelId}`, JSON.stringify({ level, isMuted, muteUntil }));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 max-w-md w-full mx-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-white/70 text-sm mb-2">
              For <span className="font-medium text-white">#{channelName}</span>
            </p>
          </div>

          {/* Notification Level */}
          <div>
            <label className="text-white font-medium text-sm mb-2 block">
              Notification Level
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={level === 'all'}
                  onChange={e => setLevel(e.target.value as NotificationLevel)}
                  className="accent-brand-500"
                />
                <div>
                  <div className="text-white text-sm">All messages</div>
                  <div className="text-white/50 text-xs">Get notified for every message</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  value="mentions"
                  checked={level === 'mentions'}
                  onChange={e => setLevel(e.target.value as NotificationLevel)}
                  className="accent-brand-500"
                />
                <div>
                  <div className="text-white text-sm">@mentions only</div>
                  <div className="text-white/50 text-xs">Only when you're mentioned</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  value="nothing"
                  checked={level === 'nothing'}
                  onChange={e => setLevel(e.target.value as NotificationLevel)}
                  className="accent-brand-500"
                />
                <div>
                  <div className="text-white text-sm">Nothing</div>
                  <div className="text-white/50 text-xs">No notifications at all</div>
                </div>
              </label>
            </div>
          </div>

          {/* Mute Channel */}
          <div className="border-t border-white/10 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMuted}
                onChange={e => setIsMuted(e.target.checked)}
                className="accent-brand-500"
              />
              <span className="text-white text-sm">Mute this channel</span>
            </label>
            {isMuted && (
              <div className="mt-2 ml-6">
                <label className="flex items-center gap-2 text-sm text-white/70 mb-2">
                  <input
                    type="checkbox"
                    checked={customSchedule}
                    onChange={e => setCustomSchedule(e.target.checked)}
                    className="accent-brand-500"
                  />
                  <span>Mute until specific time</span>
                </label>
                {customSchedule && (
                  <input
                    type="datetime-local"
                    value={muteUntil}
                    onChange={e => setMuteUntil(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                  />
                )}
                {!customSchedule && (
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        const date = new Date();
                        date.setHours(date.getHours() + 1);
                        setMuteUntil(date.toISOString().slice(0, 16));
                        setCustomSchedule(true);
                      }}
                      className="block text-brand-400 hover:text-brand-300 text-xs"
                    >
                      For 1 hour
                    </button>
                    <button
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 1);
                        setMuteUntil(date.toISOString().slice(0, 16));
                        setCustomSchedule(true);
                      }}
                      className="block text-brand-400 hover:text-brand-300 text-xs"
                    >
                      Until tomorrow
                    </button>
                    <button
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 7);
                        setMuteUntil(date.toISOString().slice(0, 16));
                        setCustomSchedule(true);
                      }}
                      className="block text-brand-400 hover:text-brand-300 text-xs"
                    >
                      For 1 week
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={saveSettings} className="flex-1">
              Save Settings
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
