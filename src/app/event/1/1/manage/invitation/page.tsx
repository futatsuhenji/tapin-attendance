'use client';

import { useState } from 'react';

type Mode = 'create' | 'edit' | 'view';

type EventMail = {
  title: string;
  body: string;
  customDataJson: string;
};

export default function EventInvitationPage() {

  /**
   * 仮：状態切り替え
   * - create: 未作成
   * - edit: 保存済み
   * - view: 送付済み
   */
  const [mode, setMode] = useState<Mode>('create');

  /**
   * 仮データ
   * ※ backendできたら fetch に置き換える想定
   */
  const [mail, setMail] = useState<EventMail>({
    title: '',
    body: '',
    customDataJson: '{}',
  });

  const isReadOnly = mode === 'view';

  const handleSave = () => {
    // 仮保存処理
    console.log('save', mail);
    setMode('edit');
  };

  const handleJsonChange = (value: string) => {
    setMail({ ...mail, customDataJson: value });
  };

  return (

    <div style={{ maxWidth: 800,margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1>イベントメール</h1>

        <p style={{ color: '#666', marginTop: 8 }}>
          現在のモード: <strong>{mode}</strong>
        </p>
      </header>

      <section>
        {/* タイトル */}
        <div style={{ marginBottom: 16 }}>
          <label>
            <div>メールタイトル</div>
            <input
              type="text"
              value={mail.title}
              disabled={isReadOnly}
              onChange={(e) =>
                setMail({ ...mail, title: e.target.value })
              }
              style={{ width: '100%' , backgroundColor: '#999999'}}
            />
          </label>
        </div>

        {/* 本文 */}
        <div style={{ marginBottom: 16 }}>
          <label>
            <div>メール本文</div>
            <textarea
              value={mail.body}
              disabled={isReadOnly}
              onChange={(e) =>
                setMail({ ...mail, body: e.target.value })
              }
              rows={8}
              style={{ width: '100%' , backgroundColor: '#999999'}}
            />
          </label>
        </div>

      </section>

      {/* フッター操作 */}
      <footer style={{ marginTop: 32 }}>
        {mode !== 'view' && (
          <button
            onClick={handleSave}
          >
            保存
          </button>
        )}

        {mode === 'view' && (
          <p style={{ color: '#666' }}>
            このメールは送付済みのため編集できません
          </p>
        )}
      </footer>
    </div>
  );
}
