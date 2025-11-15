document.addEventListener('DOMContentLoaded', () => {
    const addressInput = document.getElementById('addressInput');
    const queryButton = document.getElementById('queryButton');
    const resultDiv = document.getElementById('result');

    async function handleQuery() {
        const address = addressInput.value.trim();
        if (address.length < 2) {
            showResult('请输入至少2个字符的地址信息。', 'error');
            return;
        }

        showResult('正在查询中...', 'loading');
        queryButton.disabled = true;

        try {
            // 注意：我们请求的是自己的后端API，而不是高德
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: address }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '查询服务出错');
            }

            const data = await response.json();
            showResult(data.completedAddress, data.isFallback ? 'warning' : 'success', data);

        } catch (error) {
            console.error("查询失败:", error);
            showResult(`查询失败: ${error.message}`, 'error');
        } finally {
            queryButton.disabled = false;
        }
    }

    function showResult(text, type = 'success', data = null) {
        resultDiv.innerHTML = '';

        // 创建结果容器
        const resultContainer = document.createElement('div');
        resultContainer.className = `result-container result-${type}`;

        // 创建地址文本
        const addressText = document.createElement('div');
        addressText.className = 'address-text';
        addressText.textContent = text;
        resultContainer.appendChild(addressText);

        // 如果是成功结果，添加复制按钮
        if (type === 'success' || type === 'warning') {
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>复制地址</span>
            `;

            copyButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    showCopySuccess(copyButton);
                } catch (err) {
                    // 降级方案：使用传统复制方法
                    fallbackCopyToClipboard(text);
                    showCopySuccess(copyButton);
                }
            });

            resultContainer.appendChild(copyButton);

            // 如果有组件信息，显示详细信息
            if (data && data.components) {
                const componentsInfo = document.createElement('div');
                componentsInfo.className = 'components-info';
                componentsInfo.innerHTML = `
                    <div class="components-title">地址解析：</div>
                    <div class="components-list">
                        ${data.components.province ? `<span class="component-tag">${data.components.province}</span>` : ''}
                        ${data.components.city ? `<span class="component-tag">${data.components.city}</span>` : ''}
                        ${data.components.district ? `<span class="component-tag">${data.components.district}</span>` : ''}
                        ${data.components.township ? `<span class="component-tag">${data.components.township}</span>` : ''}
                    </div>
                `;
                resultContainer.appendChild(componentsInfo);
            }

            // 如果是降级结果，显示提示信息
            if (type === 'warning' && data.message) {
                const warningInfo = document.createElement('div');
                warningInfo.className = 'warning-info';
                warningInfo.textContent = `💡 ${data.message}`;
                resultContainer.appendChild(warningInfo);
            }
        }

        resultDiv.appendChild(resultContainer);
    }

    function showCopySuccess(button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>已复制</span>
        `;
        button.classList.add('copied');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    }

    queryButton.addEventListener('click', handleQuery);
    addressInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleQuery();
        }
    });
});
