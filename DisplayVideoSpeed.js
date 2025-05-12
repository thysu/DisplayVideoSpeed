// ==UserScript==
// @name         视频播放速度显示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  为h5播放器添加一个显示当前播放速度的区域
// @author       thysu
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    const DEFAULT_CONFIG = {
        bgOpacity: 0.6,
        textOpacity: 0.85,
        fontSize: 14,
        persistMode: 'timed',
        hideDelay: 5,
        theme: 'light'
    };

    let config = { ...DEFAULT_CONFIG, ...JSON.parse(GM_getValue('config', '{}')) };
    let settingsPanel = null;
    const videoDisplays = new WeakMap();

    // 核心显示功能
    function updateDisplayContent(video, display) {
        display.textContent = `${video.playbackRate.toFixed(1)}x`;
        handleDisplayVisibility(display, 'show');
    }

    function createDisplay(video) {
        const div = document.createElement('div');
        applyDisplayStyle(div);
        video.parentNode.appendChild(div);
        updateDisplayContent(video, div);
        return div;
    }

    function applyDisplayStyle(element) {
        Object.assign(element.style, {
            position: 'absolute',
            left: '15px',
            top: '15px',
            background: `rgba(0, 0, 0, ${config.bgOpacity})`,
            color: `rgba(255, 255, 255, ${config.textOpacity})`,
            padding: '5px 10px',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
            fontSize: `${config.fontSize}px`,
            zIndex: '2147483647',
            pointerEvents: 'none',
            transition: 'opacity 0.3s, background 0.3s, color 0.3s'
        });
    }

    // 设置面板功能（修复主题问题）
    function createSettingsPanel() {
        const isDark = config.theme === 'dark';
        const titleColor = isDark ? '#fff' : '#000';
        const selectBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        const selectColor = isDark ? '#fff' : '#000';
        const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.97)'};
            color: ${selectColor} !important;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 999999;
            min-width: 320px;
            backdrop-filter: blur(5px);
        `;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; font-size:18px; color:${titleColor} !important; font-weight:600;">播放器设置</h3>
                <button id="closeSettings" style="
                    padding:0;
                    width:28px;
                    height:28px;
                    border:none;
                    background:${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
                    color:${selectColor} !important;
                    border-radius:50%;
                    cursor:pointer;
                    font-size:20px;
                    line-height:1;
                    transition: all 0.2s;
                ">×</button>
            </div>
            <div class="setting-item" style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:4px; color:${selectColor};">主题模式</label>
                <select id="theme" style="
                    width:100%;
                    padding:8px;
                    border-radius:4px;
                    background:${selectBg} !important;
                    border:1px solid ${borderColor};
                    color:${selectColor} !important;
                    appearance: none;
                ">
                    <option value="light">浅色主题</option>
                    <option value="dark">深色主题</option>
                </select>
            </div>
            <div class="setting-item" style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:4px; color:${selectColor};">背景透明度</label>
                <input type="range" id="bgOpacity" min="0" max="1" step="0.05" value="${config.bgOpacity}"
                    style="width:100%; margin-top:8px; accent-color:${isDark ? '#fff' : '#2196F3'};">
                <div style="display:flex; justify-content:space-between; margin-top:4px; color:${selectColor};">
                    <span>0%</span>
                    <span id="bgOpacityValue">${Math.round(config.bgOpacity * 100)}%</span>
                    <span>100%</span>
                </div>
            </div>
            <div class="setting-item" style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:4px; color:${selectColor};">文字透明度</label>
                <input type="range" id="textOpacity" min="0" max="1" step="0.05" value="${config.textOpacity}"
                    style="width:100%; margin-top:8px; accent-color:${isDark ? '#fff' : '#2196F3'};">
                <div style="display:flex; justify-content:space-between; margin-top:4px; color:${selectColor};">
                    <span>0%</span>
                    <span id="textOpacityValue">${Math.round(config.textOpacity * 100)}%</span>
                    <span>100%</span>
                </div>
            </div>
            <div class="setting-item" style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:4px; color:${selectColor};">字体大小</label>
                <input type="number" id="fontSize" min="10" max="24" value="${config.fontSize}"
                    style="width:100%; padding:8px; border-radius:4px;
                    border:1px solid ${borderColor};
                    background:transparent;
                    color:${selectColor};">
            </div>
            <div class="setting-item" style="margin-bottom:12px;">
                <label style="display:block; margin-bottom:4px; color:${selectColor};">显示模式</label>
                <select id="persistMode" style="width:100%; padding:8px; border-radius:4px;
                    border:1px solid ${borderColor};
                    background:${selectBg};
                    color:${selectColor};
                    appearance: none;">
                    <option value="always">常驻显示</option>
                    <option value="timed">定时隐藏</option>
                </select>
            </div>
            <div class="setting-item" ${config.persistMode === 'timed' ? '' : 'style="display:none;"'}>
                <label style="display:block; margin-bottom:4px; color:${selectColor};">隐藏延时</label>
                <input type="number" id="hideDelay" min="1" max="60" value="${config.hideDelay}"
                    style="width:100%; padding:8px; border-radius:4px;
                    border:1px solid ${borderColor};
                    background:transparent;
                    color:${selectColor};">
            </div>
            <div style="margin-top:20px; display:grid; gap:10px; grid-template-columns:1fr 1fr;">
                <button id="saveSettings" style="padding:10px; background:#2196F3; color:white; border:none; border-radius:6px; cursor:pointer; transition: opacity 0.2s;">保存设置</button>
                <button id="resetSettings" style="padding:10px; background:#666; color:white; border:none; border-radius:6px; cursor:pointer; transition: opacity 0.2s;">恢复默认</button>
            </div>
        `;

        // 初始化设置项
        panel.querySelector('#theme').value = config.theme;
        panel.querySelector('#persistMode').value = config.persistMode;
        initSettingsEvents(panel);
        return panel;
    }

    function initSettingsEvents(panel) {
        // 关闭按钮
        panel.querySelector('#closeSettings').addEventListener('click', () => {
            panel.remove();
        });

        // 实时生效修复
        const realtimeInputs = ['bgOpacity', 'textOpacity', 'fontSize'];
        realtimeInputs.forEach(id => {
            const input = panel.querySelector(`#${id}`);
            input.addEventListener('input', () => {
                const tempConfig = {
                    ...config,
                    [id]: input.type === 'range' ?
                        parseFloat(input.value) :
                        parseInt(input.value)
                };

                // 更新百分比显示
                if (id.includes('Opacity')) {
                    panel.querySelector(`#${id}Value`).textContent =
                        `${Math.round(tempConfig[id] * 100)}%`;
                }

                updateAllDisplays(tempConfig);
            });
        });

        // 主题切换实时预览
        panel.querySelector('#theme').addEventListener('change', (e) => {
            const isDark = e.target.value === 'dark';
            const newColor = isDark ? '#fff' : '#000';
            const newBg = isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.97)';
            const newBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

            // 更新面板样式
            panel.style.background = newBg;
            panel.style.color = newColor;

            // 更新所有文本颜色
            panel.querySelectorAll('h3, label, span, select').forEach(el => {
                el.style.color = newColor;
            });

            // 更新输入控件样式
            panel.querySelectorAll('input, select').forEach(el => {
                el.style.borderColor = newBorder;
                el.style.color = newColor;
                if (el.type === 'range') {
                    el.style.accentColor = isDark ? '#fff' : '#2196F3';
                }
            });

            // 更新关闭按钮样式
            panel.querySelector('#closeSettings').style.background =
                isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        });

        // 保存设置
        panel.querySelector('#saveSettings').addEventListener('click', () => {
            const newConfig = {
                theme: panel.querySelector('#theme').value,
                bgOpacity: parseFloat(panel.querySelector('#bgOpacity').value),
                textOpacity: parseFloat(panel.querySelector('#textOpacity').value),
                fontSize: parseInt(panel.querySelector('#fontSize').value),
                persistMode: panel.querySelector('#persistMode').value,
                hideDelay: parseInt(panel.querySelector('#hideDelay').value)
            };

            GM_setValue('config', JSON.stringify(newConfig));
            config = newConfig;
            updateAllDisplays(config, true);
            panel.remove();
        });

        // 恢复默认
        panel.querySelector('#resetSettings').addEventListener('click', () => {
            GM_setValue('config', JSON.stringify(DEFAULT_CONFIG));
            config = { ...DEFAULT_CONFIG };
            updateAllDisplays(config, true);
            panel.remove();
        });
    }

    // 定时隐藏逻辑
    function handleDisplayVisibility(display, action) {
        clearTimeout(display.hideTimer);

        if (config.persistMode === 'always') {
            display.style.opacity = '1';
            return;
        }

        if (action === 'show') {
            display.style.opacity = '1';
            display.hideTimer = setTimeout(() => {
                display.style.opacity = '0';
            }, config.hideDelay * 1000);
        } else {
            display.style.opacity = '0';
        }
    }

    // 初始化播放器
    function initPlayer(video) {
        if (videoDisplays.has(video)) return;

        const display = createDisplay(video);
        videoDisplays.set(video, display);

        const eventHandlers = {
            ratechange: () => {
                updateDisplayContent(video, display);
                handleDisplayVisibility(display, 'show');
            },
            mouseenter: () => handleDisplayVisibility(display, 'show'),
            mouseleave: () => handleDisplayVisibility(display, 'hide')
        };

        video.addEventListener('ratechange', eventHandlers.ratechange);
        video.parentElement.addEventListener('mouseenter', eventHandlers.mouseenter);
        if (config.persistMode === 'timed') {
            video.parentElement.addEventListener('mouseleave', eventHandlers.mouseleave);
        }

        display._events = eventHandlers;
    }

    // 全局初始化
    function init() {
        // 添加设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙';
        settingsBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            padding: 10px 14px;
            border-radius: 50%;
            background: ${config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
            color: ${config.theme === 'dark' ? '#fff' : '#2c3e50'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: pointer;
            border: none;
            font-size: 18px;
            backdrop-filter: blur(4px);
            transition: all 0.3s;
        `;
        settingsBtn.addEventListener('click', () => {
            settingsPanel = createSettingsPanel();
            document.body.appendChild(settingsPanel);
        });
        document.body.appendChild(settingsBtn);

        // 监听DOM变化
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.tagName === 'VIDEO') initPlayer(node);
                    if (node.querySelector) {
                        const videos = node.querySelectorAll('video');
                        videos.forEach(video => initPlayer(video));
                    }
                }
            }
        });
        observer.observe(document, { childList: true, subtree: true });

        // 初始化现有视频
        document.querySelectorAll('video').forEach(initPlayer);
    }

    // 更新所有显示实例
    function updateAllDisplays(tempConfig, forceUpdate = false) {
        document.querySelectorAll('video').forEach(video => {
            const display = videoDisplays.get(video);
            if (display) {
                Object.assign(display.style, {
                    background: `rgba(0, 0, 0, ${tempConfig.bgOpacity})`,
                    color: `rgba(255, 255, 255, ${tempConfig.textOpacity})`,
                    fontSize: `${tempConfig.fontSize}px`
                });

                if (forceUpdate) {
                    video.parentElement.removeEventListener('mouseleave', display._events.mouseleave);
                    if (tempConfig.persistMode === 'timed') {
                        video.parentElement.addEventListener('mouseleave', display._events.mouseleave);
                    }
                }
                handleDisplayVisibility(display, 'show');
            }
        });
    }

    // 启动脚本
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

    // 清理监听器
    window.addEventListener('unload', () => {
        document.querySelectorAll('video').forEach(video => {
            const display = videoDisplays.get(video);
            if (display) {
                video.removeEventListener('ratechange', display._events.ratechange);
                video.parentElement.removeEventListener('mouseenter', display._events.mouseenter);
                video.parentElement.removeEventListener('mouseleave', display._events.mouseleave);
            }
        });
    }, { once: true });
})();