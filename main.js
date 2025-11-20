// ==UserScript==
// @name         Bilibili 批量拉黑「接下来播放」作者
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Batch block creators from the Bilibili video playback recommendation list (Right Sidebar)
// @author       Gemini & Secirian
// @match        https://www.bilibili.com/video/*
// @license      GNU GPLv3
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @icon            https://cdn.jsdelivr.net/gh/the1812/Bilibili-Evolved@preview/images/logo-small.png
// @icon64          https://cdn.jsdelivr.net/gh/the1812/Bilibili-Evolved@preview/images/logo.png
// ==/UserScript==

(function () {
    'use strict';

    /*************** Configuration ***************/

    const CONFIG = {
        // The main container for the right sidebar recommendations
        containerSelector: '.recommend-list-v1',
        // The "Expand" button at the bottom of the list
        expandBtnSelector: '.recommend-list-v1 .rec-footer',
        // The specific link inside the card that points to the creator's space
        upLinkSelector: '.video-page-card-small .upname a',
        // Interval between API requests (ms) to avoid rate limiting
        blockInterval: 300,
        // Time to wait after clicking "Expand" (ms)
        expandWaitTime: 1500
    };

    /*************** Initialization ***************/

    const getCsrfToken = () => {
        const match = document.cookie.match(/bili_jct=([^;]+)/);
        return match ? match[1] : null;
    };

    const csrf_token = getCsrfToken();

    /*************** Utility Functions ***************/

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const parseUidFromUrl = (url) => {
        const match = url.match(/space\.bilibili\.com\/(\d+)/);
        return match ? match[1] : null;
    };

    /*************** Logic: Actions ***************/

    // New function: Auto click the expand button
    async function expandListIfNeeded() {
        const expandBtn = document.querySelector(CONFIG.expandBtnSelector);

        // Check if button exists and is visible (not display: none)
        if (expandBtn && expandBtn.offsetParent !== null) {
            console.log('🔽 Found "Expand" button. Clicking...');
            expandBtn.click();
            // Wait for DOM to update
            await sleep(CONFIG.expandWaitTime);
        } else {
            console.log('ℹ️ "Expand" button not found or already expanded.');
        }
    }

    async function blockUser(uid) {
        if (!csrf_token) return { success: false, msg: "Not Logged In" };

        const body = new URLSearchParams({
            fid: uid,
            act: 5, // 5 = Block
            re_src: 11,
            jsonp: 'jsonp',
            csrf: csrf_token
        });

        try {
            const res = await fetch('https://api.bilibili.com/x/relation/modify', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            });

            const data = await res.json();
            if (data.code === 0) {
                console.log(`🚫 Blocked UID: ${uid}`);
                return { success: true, uid: uid };
            } else {
                console.warn(`⚠️ Failed to block UID ${uid}: ${data.message}`);
                return { success: false, uid: uid, msg: data.message };
            }
        } catch (err) {
            console.error(`❌ Network error blocking UID ${uid}`, err);
            return { success: false, uid: uid, msg: 'Network Error' };
        }
    }

    function getRecommendationUids() {
        const container = document.querySelector(CONFIG.containerSelector);
        if (!container) return [];

        const links = container.querySelectorAll(CONFIG.upLinkSelector);
        const uids = new Set();

        links.forEach(link => {
            const uid = parseUidFromUrl(link.href);
            if (uid) uids.add(uid);
        });

        console.log(`📥 Found ${uids.size} unique creators.`);
        return Array.from(uids);
    }

    /*************** Main Workflow ***************/

    async function startBatchBlock() {
        if (!csrf_token) {
            alert("Please login to Bilibili first.");
            return;
        }

        // Step 1: Auto Expand
        await expandListIfNeeded();

        // Step 2: Extract UIDs
        const uidArray = getRecommendationUids();
        if (uidArray.length === 0) {
            alert('⚠️ No creators found. Please check page structure.');
            return;
        }

        // Step 3: Confirm
        const confirmMsg = `Found ${uidArray.length} creators (List Expanded).\n\nAre you sure you want to BLOCK them all?`;
        if (!confirm(confirmMsg)) return;

        // Step 4: Process
        const statusDiv = createStatusOverlay();
        let successCount = 0;

        for (let i = 0; i < uidArray.length; i++) {
            const uid = uidArray[i];
            statusDiv.innerText = `Blocking: ${i + 1}/${uidArray.length}\nUID: ${uid}`;
            const result = await blockUser(uid);
            if (result.success) successCount++;
            await sleep(CONFIG.blockInterval);
        }

        statusDiv.remove();
        alert(`✅ Batch block complete.\nSuccessfully blocked: ${successCount}/${uidArray.length}`);
    }

    /*************** UI Elements ***************/

    function createStatusOverlay() {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            borderRadius: '8px',
            zIndex: 100001,
            textAlign: 'center',
            fontSize: '16px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        });
        document.body.appendChild(div);
        return div;
    }

    function createStartButton() {
        if (document.getElementById('batch-block-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'batch-block-btn';
        btn.textContent = '🚫 Block All';
        Object.assign(btn.style, {
            position: 'fixed',
            top: '150px',
            right: '0px',
            padding: '8px 12px',
            backgroundColor: '#FF6699',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: '6px',
            borderBottomLeftRadius: '6px',
            cursor: 'pointer',
            zIndex: 99999,
            fontSize: '13px',
            fontWeight: 'bold',
            boxShadow: '-2px 2px 5px rgba(0,0,0,0.2)'
        });

        btn.onmouseover = () => btn.style.backgroundColor = '#ff4d85';
        btn.onmouseout = () => btn.style.backgroundColor = '#FF6699';
        btn.onclick = startBatchBlock;

        document.body.appendChild(btn);
    }

    window.addEventListener('load', () => {
        setTimeout(createStartButton, 2000);
    });

})();
