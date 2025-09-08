document.addEventListener('DOMContentLoaded', () => {
    const addressInput = document.getElementById('addressInput');
    const queryButton = document.getElementById('queryButton');
    const resultDiv = document.getElementById('result');

    async function handleQuery() {
        const address = addressInput.value.trim();
        if (address.length < 4) {
            resultDiv.textContent = '请输入更详细的地址信息。';
            return;
        }

        resultDiv.textContent = '正在查询中...';
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
            resultDiv.textContent = data.completedAddress;

        } catch (error) {
            console.error("查询失败:", error);
            resultDiv.textContent = `查询失败: ${error.message}`;
        } finally {
            queryButton.disabled = false;
        }
    }

    queryButton.addEventListener('click', handleQuery);
    addressInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleQuery();
        }
    });
});
