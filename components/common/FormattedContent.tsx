import React from 'react';

export const FormattedContent: React.FC<{ content: string | string[] }> = ({ content }) => {
    const rawContent = Array.isArray(content) ? content.join('\n') : content;
    const lines = rawContent.split('\n').filter(line => line.trim() !== '');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isListItem = line.startsWith('・') || line.startsWith('-') || line.startsWith('*');

        if (isListItem) {
            listItems.push(line.replace(/^[・*-]\s*/, ''));
        } else {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${i}`} className="list-disc list-outside pl-5 space-y-1 my-2">
                        {listItems.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                );
                listItems = [];
            }
            elements.push(<p key={`p-${i}`} className="my-1">{line}</p>);
        }
    }

    if (listItems.length > 0) {
        elements.push(
            <ul key="ul-last" className="list-disc list-outside pl-5 space-y-1 my-2">
                {listItems.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
        );
    }

    return <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{elements.length > 0 ? elements : <p>{rawContent}</p>}</div>;
};
