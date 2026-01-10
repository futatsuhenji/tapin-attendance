'use client';

import RichMailEditor from '@/components/richMailEditor';

export default function Page() {
    return (
        <div className="mx-auto max-w-3xl p-6">
            <h1 className="text-xl font-semibold mb-4">イベントメール リッチ編集（PoC）</h1>

            <RichMailEditor
                initialJson={null}
                onSave={async ({ json, html }) => {
                    // ハッカソン用：とりあえずログ
                    console.log('SAVE JSON', json);
                    console.log('SAVE HTML', html);

                    // 実際はここでAPIへPOST
                    // await fetch('/api/event-mail/custom', { method:'POST', body: JSON.stringify({ customDataJson: json }) })
                    alert('保存処理（仮）を呼びました。consoleを確認してください。');
                }}
            />
        </div>
    );
}
