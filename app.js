// Inicialização do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVLx65ITELcKaavvQYyKO30I_waRTddb0",
  authDomain: "mapa-interativo---spot-picker.firebaseapp.com",
  projectId: "mapa-interativo---spot-picker",
  storageBucket: "mapa-interativo---spot-picker.firebasestorage.app",
  messagingSenderId: "640340826901",
  appId: "1:640340826901:web:331f5e3f6086be451d671c",
  measurementId: "G-6FMBGXEJBC"
};

// Conecta o app e o banco de dados
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Torna o db global para podermos acessar em outras partes do código
window.db = db;
const auth = getAuth(app);
window.auth = auth;
// Dados Globais do Sistema e Configuração
const USER_DB = {
    'nathalia@gamescom.com.br': { role: 'ADMIN', name: 'Admin Supremo' },
    'ana@gamescom.com.br': { role: 'MANAGER', name: 'Gerente Produção', events: ['evt1', 'evt2'] },
    'vendas@spotpicker.com': { role: 'USER', name: 'Ricardo Viana', events: ['evt1'] },
    'diretoria@spotpicker.com': { role: 'USER', name: 'Camila Fonseca', events: ['evt1', 'evt2'] },
    'teste@gmail.com': { role: 'ADMIN', name: 'Testador' }
};

const THEMES = {
    'Light': { bg: '#f4f6f8', surface: '#ffffff', surface2: '#edf0f4', border: '#dce2ea', text: '#1a2330', muted: '#7a8fa0', accent: '#d08010', occupied: '#c83030', available: '#188040', reserved: '#2860d0', maintenance: '#7030b0' },
    'Dark': { bg: '#08090d', surface: '#0e1117', surface2: '#141923', border: '#1e2a38', text: '#c8d5e2', muted: '#4e6070', accent: '#e8a020', occupied: '#e04848', available: '#24c864', reserved: '#3878f0', maintenance: '#9850e0' }
};

let EVENTS_DB = [];

const LABELS = {
    occupied: 'Ocupado',
    reserved: 'Reservado',
    available: 'Livre',
    maintenance: 'Manutenção'
};

// Estado da Aplicação
let currentUser = null;
let currentEvent = null;

let currentStatusFilter = 'all';
let currentAreaFilter = 'all';
let filterMyBooths = false;
let currentSearch = '';
let selectedBoothId = null;
let transform = { x: 0, y: 0, scale: 1 };
let isBgEditMode = false;
let currentDrawMode = null; // 'booth' | 'area'
let tempDrawStart = null;
let tempDrawRect = null;

const mapViewport = document.querySelector('.map-viewport');

let isEventsLoaded = false;

function loadEventsFromFirebase() {
    onSnapshot(collection(window.db, "events"), (snapshot) => {
        EVENTS_DB = [];
        snapshot.forEach((doc) => {
            EVENTS_DB.push({ id: doc.id, ...doc.data() });
        });
        
        if (!isEventsLoaded) {
            isEventsLoaded = true;
            const loginBtn = document.getElementById('btnGoogleLogin');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerText = "Entrar com Google";
            }
            
            // CORREÇÃO DA CORRIDA: Se o Auth já liberou o usuário antes do banco carregar, 
            // chama o acesso agora que os eventos estão prontos!
            if (currentUser) {
                checkAccess(currentUser.email, Object.keys(USER_DB));
            }
        }

        if (currentUser && currentEvent) {
            currentEvent = EVENTS_DB.find(e => e.id === currentEvent.id);
            if (currentEvent) {
                renderTopBar();
                renderStats();
                renderAreaTabs();
                renderMapBg();
                renderAreas();
                renderMap();
                renderList();
                renderHistory();
            } else if (currentUser.role === 'ADMIN' && EVENTS_DB.length > 0) {
                // Se o evento ativo foi deletado, muda para o primeiro da lista
                switchEvent(EVENTS_DB[0].id);
            }
        }
    });
}

async function saveEventToFirebase(evt) {
    if(!evt) return;
    try {
        await setDoc(doc(window.db, "events", evt.id), evt);
    } catch(err) {
        console.error("Erro ao salvar no Firestore:", err);
    }
}

let globalSaveTimeout = null;
function debouncedSaveEventToFirebase(evt) {
    if(!evt) return;
    clearTimeout(globalSaveTimeout);
    globalSaveTimeout = setTimeout(() => saveEventToFirebase(evt), 600);
}

// Inicialização Auth Flow
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('btnGoogleLogin');
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerText = "Conectando...";
        loginBtn.addEventListener('click', startGoogleLogin);
    }
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let authorizedList = [];
            try {
                const response = await fetch('emails_autorizados.txt');
                if (!response.ok) throw new Error('File not found');
                const text = await response.text();
                authorizedList = text.split('\n').map(e => e.trim().toLowerCase());
            } catch (e) {
                console.warn('Usando lista de fallback.');
                authorizedList = Object.keys(USER_DB);
            }
            checkAccess(user.email.toLowerCase(), authorizedList);
        }
    });

    loadEventsFromFirebase();
});

async function startGoogleLogin() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch(err) {
        console.error("Erro no login:", err);
        alert('Falha ao autenticar com Google.');
    }
}

function checkAccess(email, authorizedList) {
    if (authorizedList.includes(email) && USER_DB[email]) {
        currentUser = USER_DB[email];
        currentUser.email = email; // Salva o e-mail no objeto para referência

        // CORREÇÃO DA CORRIDA: Se o banco de eventos não carregou, aborte. 
        // O loadEventsFromFirebase vai chamar essa função de novo depois.
        if (!isEventsLoaded) return;
        
        if (currentUser.role === 'ADMIN') {
            currentEvent = EVENTS_DB[0]; // Pega o primeiro evento (se existir)
        } else {
            currentEvent = EVENTS_DB.find(e => currentUser.events.includes(e.id));
        }

        if(!currentEvent && currentUser.role !== 'ADMIN') {
            alert('Você não tem eventos atribuídos.');
            return;
        }

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('deniedScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // CORREÇÃO DO BANCO VAZIO: Se o Admin deletar todos os eventos, cria um "fantasma" 
        // temporário para a tela abrir e ele conseguir clicar no menu e criar um novo
        if (!currentEvent && currentUser.role === 'ADMIN') {
            currentEvent = {
                id: 'temp_vazio', name: 'Nenhum Evento (Crie um novo)',
                theme: JSON.parse(JSON.stringify(THEMES['Light'])),
                font: 'DM Sans', bgImage: { url: '', x: 0, y: 0, scale: 1, rotation: 0 },
                areas: [], booths: [], history: []
            };
        }

        initWebApp();
    } else {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('deniedScreen').classList.remove('hidden');
        document.getElementById('deniedEmail').innerText = email;
    }
}

function initWebApp() {
    renderTopBar();
    updateUIPermissions();
    renderStats();
    renderAreaTabs();
    renderMapBg();
    renderAreas();
    renderMap();
    renderList();
    renderHistory();
    setupEvents();
    setupPanZoom();
    setupDragAndDrop();
    applyEventThemeAndFont();
    
    // Chamada automática temporária para upload dos dados (removida)
    // if (window.uploadInitialDataToFirebase) {
    //     window.uploadInitialDataToFirebase();
    // }
}

function applyEventThemeAndFont() {
    const t = currentEvent.theme;
    const s = document.body.style;
    s.setProperty('--bg', t.bg);
    s.setProperty('--surface', t.surface);
    s.setProperty('--surface2', t.surface2);
    s.setProperty('--border', t.border);
    s.setProperty('--text', t.text);
    s.setProperty('--muted', t.muted);
    s.setProperty('--accent', t.accent);
    
    s.setProperty('--occupied', t.occupied);
    s.setProperty('--reserved', t.reserved);
    s.setProperty('--available', t.available);
    s.setProperty('--maintenance', t.maintenance);

    s.setProperty('--font-sans', `'${currentEvent.font}', sans-serif`);
    
    // Atualiza badges dinamicamente (pois a cor não vem só das vars em alguns hardcoded styles, garantindo integridade visual)
    document.querySelectorAll('.status-badge').forEach(badge => {
        if(badge.classList.contains('occupied')) badge.style.color = t.occupied;
        if(badge.classList.contains('available')) badge.style.color = t.available;
        if(badge.classList.contains('reserved')) badge.style.color = t.reserved;
        if(badge.classList.contains('maintenance')) badge.style.color = t.maintenance;
    });
}

function renderTopBar() {
    let dropdownHtml = '<div class="event-dropdown-menu">';
    
let availableEvents = EVENTS_DB;
    if (currentUser.role !== 'ADMIN') {
        // Usuários comuns veem apenas os permitidos e que estão visíveis
        availableEvents = EVENTS_DB.filter(e => currentUser.events.includes(e.id) && e.visible !== false);
    } 
    // ADMIN vê a lista inteira de eventos (sem filtro de visibilidade na barra)

    availableEvents.forEach(evt => {
        dropdownHtml += `<div class="event-option" onclick="switchEvent('${evt.id}')">${evt.name}</div>`;
    });

    dropdownHtml += '</div>';

    const selector = document.getElementById('eventSelectorDropdown');
    selector.innerHTML = `
        <span id="currentEventLabel">${currentEvent.name}</span>
        <span class="dropdown-icon">▼</span>
        ${dropdownHtml}
    `;
}

window.switchEvent = function(id) {
    currentEvent = EVENTS_DB.find(e => e.id === id);
    currentAreaFilter = 'all';
    currentStatusFilter = 'all';
    currentSearch = '';
    selectedBoothId = null;
    isBgEditMode = false;
    document.getElementById('bgEditModeBanner').classList.add('hidden');
    
    applyEventThemeAndFont();
    renderTopBar();
    renderStats();
    renderAreaTabs();
    renderMapBg();
    renderAreas();
    renderMap();
    renderList();
    renderHistory();
    
    transform = { x: 0, y: 0, scale: 1 };
    mapViewport.style.transform = `translate(0px, 0px) scale(1)`;
}

window.createNewEvent = function() {
    const name = prompt('Nome do novo evento:');
    if(name) {
        const newEvt = { 
            id: 'evt' + Date.now(), 
            name: name, 
            theme: JSON.parse(JSON.stringify(THEMES['Light'])), 
            font: 'DM Sans', 
            bgImage: { url: '', x: 0, y: 0, scale: 1, rotation: 0 }, 
            areas: [], booths: [], history: [] 
        };
        EVENTS_DB.push(newEvt);
        saveEventToFirebase(newEvt);
        switchEvent(newEvt.id);
    }
}

function renderStats() {
    const statsContainer = document.getElementById('topbarStats');
    const total = currentEvent.booths.length;
    const occ = currentEvent.booths.filter(b => b.status === 'occupied').length;
    const res = currentEvent.booths.filter(b => b.status === 'reserved').length;
    const avail = currentEvent.booths.filter(b => b.status === 'available').length;
    
    const pctOcc = total > 0 ? (occ / total) * 100 : 0;
    const pctRes = total > 0 ? (res / total) * 100 : 0;

    statsContainer.innerHTML = `
        <div class="stat-item"><span class="stat-label">Total</span><span class="stat-value">${total}</span></div>
        <div class="stat-item"><span class="stat-label">Ocupados</span><span class="stat-value" style="color:var(--occupied)">${occ}</span></div>
        <div class="stat-item"><span class="stat-label">Reservados</span><span class="stat-value" style="color:var(--reserved)">${res}</span></div>
        <div class="stat-item"><span class="stat-label">Livres</span><span class="stat-value" style="color:var(--available)">${avail}</span></div>
        <div class="stat-progress">
            <div class="bar-occ" style="width: ${pctOcc}%"></div>
            <div class="bar-res" style="width: ${pctRes}%"></div>
        </div>
    `;
    document.getElementById('boothCountTotal').innerText = total;
}

function renderAreaTabs() {
    const tabsContainer = document.getElementById('areaTabs');
    tabsContainer.innerHTML = `
        <button class="area-tab-btn ${currentAreaFilter === 'all' ? 'active' : ''}" data-area="all">TODAS AS ÁREAS</button>
        ${currentEvent.areas.map(a => `
            <button class="area-tab-btn ${currentAreaFilter === a.id ? 'active' : ''}" data-area="${a.id}">${a.name.toUpperCase()}</button>
        `).join('')}
    `;

    tabsContainer.querySelectorAll('.area-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAreaFilter = e.target.getAttribute('data-area');
            renderAreaTabs();
            renderMap();
            renderList();
        });
    });
}

function renderMapBg() {
    const bgImg = document.getElementById('mapBgImage');
    const bgData = currentEvent.bgImage;
    
    if (bgData && bgData.url) {
        bgImg.setAttribute('href', bgData.url);
        bgImg.style.display = 'block';
        bgImg.setAttribute('transform', `translate(${bgData.x}, ${bgData.y}) scale(${bgData.scale}) rotate(${bgData.rotation})`);
    } else {
        bgImg.style.display = 'none';
    }
}

function renderAreas() {
    const areasGroup = document.getElementById('areasGroup');
    areasGroup.innerHTML = currentEvent.areas.map(area => `
        <g opacity="1" class="area-zone" data-id="${area.id}">
            <rect x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" fill="${area.dim}" fill-opacity="0.15" rx="4" stroke="${area.accent}" stroke-width="0.8" stroke-opacity="0.4"></rect>
            <text x="${area.x + area.w / 2}" y="${area.y + 15}" text-anchor="middle" fill="${area.accent}" font-size="8.5" letter-spacing=".12em" font-family="var(--font-mono)" font-weight="500">${area.name.toUpperCase()}</text>
        </g>
    `).join('');
}

function renderMap() {
    const boothsGroup = document.getElementById('boothsGroup');
    boothsGroup.innerHTML = '';

    document.querySelectorAll('.area-zone').forEach(el => {
        if (currentAreaFilter === 'all' || el.getAttribute('data-id') === currentAreaFilter) {
            el.style.opacity = '1';
        } else {
            el.style.opacity = '0.2';
            if (filterMyBooths && booth.executive !== currentUser.name && booth.executive !== currentUser.email) opacity = 0.2;
        }
    });

    const canMove = (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && !isBgEditMode;
    const t = currentEvent.theme;

    currentEvent.booths.forEach(booth => {
        const cx = booth.x + booth.w / 2;
        const cy = booth.y + booth.h / 2;
        const rot = booth.rotation || 0;
        
        let opacity = 1;
        if (currentStatusFilter !== 'all' && booth.status !== currentStatusFilter) opacity = 0.2;
        if (currentAreaFilter !== 'all' && booth.area !== currentAreaFilter) opacity = 0.2;

        const isSelected = booth.id === selectedBoothId;
        const color = t[booth.status] || '#999';

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('svg-booth');
        if (canMove) g.classList.add('draggable');
        if (isSelected) g.classList.add('selected');
        g.setAttribute('data-id', booth.id);
        g.setAttribute('transform', `rotate(${rot}, ${cx}, ${cy})`);
        g.style.opacity = opacity;

        let content = '';
        if (isSelected) {
            content += `<rect x="${booth.x - 3}" y="${booth.y - 3}" width="${booth.w + 6}" height="${booth.h + 6}" fill="none" rx="4" stroke="${color}" stroke-width="1" stroke-dasharray="4 3"></rect>`;
        }
        
        content += `
            <rect class="bg" x="${booth.x}" y="${booth.y}" width="${booth.w}" height="${booth.h}" rx="2" style="${isSelected ? `fill: ${color}11` : ''}"></rect>
            <rect class="status-bar" x="${booth.x}" y="${booth.y}" width="${booth.w}" height="3" fill="${color}" rx="1" opacity="0.88"></rect>
            <text class="label" x="${cx}" y="${booth.y + 16}">${booth.label}</text>
        `;

        if (booth.exhibitor) {
            let truncExhibitor = booth.exhibitor.length > 11 ? booth.exhibitor.slice(0, 10) + '…' : booth.exhibitor;
            content += `<text class="exhibitor" x="${cx}" y="${booth.y + 28}" style="fill: var(--accent)">${truncExhibitor}</text>`;
        }

        if (booth.sqm) {
            content += `<text x="${cx}" y="${booth.y + booth.h - 7}" text-anchor="middle" fill="var(--muted)" font-size="5.5" font-family="var(--font-mono)">${booth.sqm}m²</text>`;
        }

        g.innerHTML = content;
        
        g.addEventListener('click', (e) => {
            if(window.isDraggingBooth || isBgEditMode) return;
            e.stopPropagation();
            selectBooth(booth.id);
        });

        g.addEventListener('wheel', (e) => {
            if(e.shiftKey && canMove && isSelected) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 5 : -5;
                booth.rotation = (booth.rotation || 0) + delta;
                renderMap();
                debouncedSaveEventToFirebase(currentEvent);
            }
        });

        boothsGroup.appendChild(g);
    });
}

function renderList() {
    const list = document.getElementById('boothList');
    list.innerHTML = '';

    const filtered = currentEvent.booths.filter(b => {
        if (currentStatusFilter !== 'all' && b.status !== currentStatusFilter) return false;
        if (currentAreaFilter !== 'all' && b.area !== currentAreaFilter) return false;
        if (filterMyBooths && b.executive !== currentUser.name && b.executive !== currentUser.email) return false;
        
        if (currentSearch) {
            const term = currentSearch.toLowerCase();
            const matchLabel = b.label.toLowerCase().includes(term);
            const matchExhibitor = (b.exhibitor || '').toLowerCase().includes(term);
            // Removido a busca por categoria da lista compacta
            if (!matchLabel && !matchExhibitor) return false;
        }
        return true;
    });
    
    document.getElementById('boothCountTotal').innerText = filtered.length;

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--muted); font-size: 12px;">Nenhum estande encontrado</div>`;
        return;
    }

    const t = currentEvent.theme;

    filtered.forEach(booth => {
        const color = t[booth.status];
        const label = LABELS[booth.status];
        
        const div = document.createElement('div');
        div.className = `booth-item ${selectedBoothId === booth.id ? 'active' : ''}`;
        div.onclick = () => selectBooth(booth.id);
        
        // Estrutura compacta: Apenas ID, Nome do Cliente e Badge
        div.innerHTML = `
            <div class="booth-info-basic">
                <span class="booth-label">${booth.label}</span>
                <span class="booth-exhibitor">${booth.exhibitor || '— vago —'}</span>
            </div>
            <span class="status-badge ${booth.status}" style="font-size: 9px; padding: 2px 6px; color: ${color}; border: 1px solid ${color}44; background: ${color}15;">${label}</span>
        `;
        list.appendChild(div);
    });
}

function renderHistory() {
    const histList = document.getElementById('historyList');
    histList.innerHTML = '';
    
    currentEvent.history.forEach(item => {
        let userEmail = Object.keys(USER_DB).find(key => USER_DB[key].name === item.user) || 'email@desconhecido.com';
        let formatAction = item.action.replace('Status alterado para ', '');
        let badgeColor = currentEvent.theme[item.status] || currentEvent.theme.text; // Cor do status
        let [datePart, timePart] = item.timestamp.split(' ');

        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="hist-top">
                <span class="hist-badge" style="background: ${badgeColor};">${item.boothLabel}</span>
                <span class="hist-action">${formatAction}</span>
                <span class="hist-time">${timePart}</span>
            </div>
            <div class="hist-detail">${item.detail}</div>
            <div class="hist-bottom">
                <div class="hist-user-info">
                    <span>${item.user}</span>
                    <span class="hist-email">${userEmail}</span>
                </div>
                <span class="hist-date">${datePart}</span>
            </div>
        `;
        histList.appendChild(div);
    });
}

function selectBooth(id) {
    if(isBgEditMode) return;
    selectedBoothId = id;
    renderMap();
    renderList();
    showDetails(id);
}

function showDetails(id) {
    const panel = document.getElementById('boothDetails');
    const booth = currentEvent.booths.find(b => b.id === id);
    const t = currentEvent.theme;
    
    if (!booth) {
        panel.classList.add('hidden');
        return;
    }

    // Configura o cabeçalho
    document.getElementById('detailLabel').innerText = booth.label;
    const badge = document.getElementById('detailStatusBadge');
    badge.className = `status-badge ${booth.status}`;
    badge.innerText = LABELS[booth.status];
    const color = t[booth.status];
    badge.style.color = color;
    badge.style.backgroundColor = `${color}15`;
    badge.style.borderColor = `${color}44`;

    // Preenche a badge da área (layout figma)
    const areaBadge = document.getElementById('detailAreaBadge');
    if (areaBadge) {
        const areaObj = currentEvent.areas.find(a => a.id === booth.area);
        areaBadge.innerText = areaObj ? areaObj.name : 'Sem área';
    }

    // Atualiza o estado do cadeado
    const lockBtn = document.getElementById('btnLockToggle');
    booth.locked = booth.locked || false;
    if(lockBtn) lockBtn.innerText = booth.locked ? '🔒' : '🔓';
    
    // Preenche os campos do formulário (sem os do Monday)
    document.getElementById('editExhibitor').value = booth.exhibitor || '';
    document.getElementById('editStatus').value = booth.status || 'available';
    document.getElementById('editExecutive').value = booth.executive || '';
    
    // Preenche as coordenadas arredondadas
    document.getElementById('editX').value = Math.round(booth.x) || 0;
    document.getElementById('editY').value = Math.round(booth.y) || 0;
    document.getElementById('editRotation').value = Math.round(booth.rotation) || 0;

    // Regras de Permissão
    const isManagerOrAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
    const isResponsible = booth.executive === currentUser.name;
    const isAvailable = booth.status === 'available';
    const canEdit = (isManagerOrAdmin || isAvailable || isResponsible) && !booth.locked;
    
    // Mostra/Oculta painel de coordenadas dependendo do papel
    const coordGrid = document.getElementById('adminCoordinatesGrid');
    if(coordGrid) coordGrid.style.display = isManagerOrAdmin ? 'flex' : 'none';
    if(lockBtn) lockBtn.style.display = isManagerOrAdmin ? 'inline-block' : 'none';

    // Bloqueia ou libera inputs dependendo da permissão e do cadeado
    document.querySelectorAll('.edit-input').forEach(input => {
        input.disabled = !canEdit;
    });

    panel.classList.remove('hidden');
}

function setupEvents() {
    document.getElementById('btnToggleList').addEventListener('click', () => document.getElementById('leftSidebar').classList.toggle('hidden'));
    document.getElementById('btnCloseList').addEventListener('click', () => document.getElementById('leftSidebar').classList.add('hidden'));

    document.getElementById('btnToggleHistory').addEventListener('click', () => document.getElementById('rightSidebar').classList.toggle('hidden'));
    document.getElementById('btnCloseHistory').addEventListener('click', () => document.getElementById('rightSidebar').classList.add('hidden'));

    document.getElementById('btnOpenConfig').addEventListener('click', openConfigModal);

    document.getElementById('btnExitBgEdit').addEventListener('click', () => {
        isBgEditMode = false;
        document.getElementById('bgEditModeBanner').classList.add('hidden');
        renderMap();
    });

document.querySelectorAll('.sidebar .filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sidebar .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const filterVal = e.target.getAttribute('data-filter');
            
            // Lógica para diferenciar se é filtro de status ou o filtro "Meus Estandes"
            if (filterVal === 'my_booths') {
                filterMyBooths = true;
                currentStatusFilter = 'all'; // Volta os status para 'all' para ver tudo que é seu
            } else {
                filterMyBooths = false;
                currentStatusFilter = filterVal;
            }
            
            selectedBoothId = null;
            document.getElementById('boothDetails').classList.add('hidden');
            renderMap();
            renderList();
        });
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderList();
    });

    document.getElementById('closeDetails').addEventListener('click', () => {
        selectedBoothId = null;
        document.getElementById('boothDetails').classList.add('hidden');
        renderMap();
        renderList();
    });

    document.getElementById('boothDetails').addEventListener('click', (e) => {
        if(e.target.classList.contains('change-status')) {
            const action = e.target.getAttribute('data-action');
            const booth = currentEvent.booths.find(b => b.id === selectedBoothId);
            if(booth) {
                if(action === 'allocate' && booth.status === 'available') {
                    booth.status = 'occupied';
                    booth.exhibitor = 'Novo Cliente';
                    booth.category = 'Nova Venda';
                    booth.executive = currentUser.name;
                    logHistory(booth.id, booth.label, 'Reserva confirmada', 'Nova reserva');
                } else if(action === 'free' && booth.status !== 'available') {
                    booth.status = 'available';
                    booth.exhibitor = '';
                    booth.category = '';
                    booth.executive = '';
                    logHistory(booth.id, booth.label, 'Estande liberado', 'Liberação manual');
                }
                showDetails(booth.id);
                renderStats();
                renderMap();
                renderList();
            }
        }
    });
    const btnDrawBooth = document.getElementById('btnDrawBooth');
    if(btnDrawBooth) btnDrawBooth.addEventListener('click', () => { currentDrawMode = 'booth'; alert('Modo Desenho: Clique e arraste no mapa para criar um ESTANDE.'); });
    
    const btnDrawArea = document.getElementById('btnDrawArea');
    if(btnDrawArea) btnDrawArea.addEventListener('click', () => { currentDrawMode = 'area'; alert('Modo Desenho: Clique e arraste no mapa para criar uma ÁREA.'); });
    
    // Garantir que ao sair da edição, o modo desenho é desativado
    document.getElementById('btnExitBgEdit').addEventListener('click', () => {
        isBgEditMode = false;
        currentDrawMode = null; // Desativa o desenho
        document.getElementById('bgEditModeBanner').classList.add('hidden');
        renderMap();
    });
}

function openConfigModal() {
    const modal = document.getElementById('configModalOverlay');
    const modalBody = modal.querySelector('.modal-body');
    const t = currentEvent.theme;
    
    // Controles de Permissão
    const isAdmin = currentUser.role === 'ADMIN';
    const isManager = currentUser.role === 'MANAGER' || isAdmin;
    const adminLock = !isAdmin ? 'disabled title="Permissão apenas para Admin"' : '';
    const adminOp = !isAdmin ? 'opacity: 0.5;' : '';

    let html = ``;

    if (isAdmin) {
        html += `
            <div class="config-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 12px; color:var(--accent);">Administração de Eventos</h3>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${EVENTS_DB.map(evt => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--surface2); border-radius:4px; border:1px solid var(--border);">
                            <span style="font-weight:600;">${evt.name}</span>
                            <div style="display:flex; gap:8px;">
                                <button class="action-btn secondary" style="font-size:11px; padding:4px 8px;" onclick="toggleEventVisibility('${evt.id}')">${evt.visible !== false ? 'Ocultar' : 'Exibir'}</button>
                                <button class="action-btn change-status" style="font-size:11px; padding:4px 8px; background:var(--occupied); color:#fff; border-color:var(--occupied);" onclick="deleteEvent('${evt.id}')">Excluir</button>
                            </div>
                        </div>
                    `).join('')}
                    <button class="action-btn new-event" style="margin-top:8px;" onclick="createNewEvent()">+ Criar Novo Evento</button>
                </div>
            </div>
        `;
    }

    if (isManager) {
        html += `
            <div class="config-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 12px;">Identidade Visual do Evento</h3>
                <div style="font-size:12px; color:var(--muted); margin-bottom:12px;">Temas Pré-definidos:</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 20px; ${adminOp}">
                    ${Object.keys(THEMES).map(themeName => `
                        <button ${adminLock} onclick="applyPresetTheme('${themeName}')" style="padding:6px 12px; font-size:11px; background:${THEMES[themeName].surface}; color:${THEMES[themeName].text}; border:1px solid ${THEMES[themeName].border}; border-radius:4px; cursor:pointer; font-weight:600;">${themeName}</button>
                    `).join('')}
                </div>

                <div style="font-size:12px; color:var(--muted); margin-bottom:12px;">Tipografia:</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom: 25px; ${adminOp}">
                    <select ${adminLock} onchange="changeFont(this.value)" style="padding:8px; border-radius:4px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-family:var(--font-sans);">
                        <option value="DM Sans" ${currentEvent.font === 'DM Sans' ? 'selected' : ''}>DM Sans</option>
                        <option value="Inter" ${currentEvent.font === 'Inter' ? 'selected' : ''}>Inter</option>
                        <option value="Roboto" ${currentEvent.font === 'Roboto' ? 'selected' : ''}>Roboto</option>
                        <option value="Outfit" ${currentEvent.font === 'Outfit' ? 'selected' : ''}>Outfit</option>
                    </select>
                    <button ${adminLock} class="action-btn secondary" onclick="simulateFontUpload()">Upload Fonte (.ttf)</button>
                </div>

                <div style="font-size:12px; color:var(--muted); margin-bottom:12px; padding-top:15px; border-top:1px solid var(--border);">Cores Personalizadas:</div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:15px; margin-bottom: 20px;">
                    <!-- Superfícies -->
                    <div style="${adminOp}">
                        <div style="font-size:11px; font-weight:600; margin-bottom:8px;">Superfícies</div>
                        <label class="color-row">Fundo Principal <input type="color" value="${t.bg}" onchange="updateThemeVar('bg', this.value)" ${adminLock}></label>
                        <label class="color-row">Painéis <input type="color" value="${t.surface}" onchange="updateThemeVar('surface', this.value)" ${adminLock}></label>
                        <label class="color-row">Hover/Secundário <input type="color" value="${t.surface2}" onchange="updateThemeVar('surface2', this.value)" ${adminLock}></label>
                        <label class="color-row">Bordas <input type="color" value="${t.border}" onchange="updateThemeVar('border', this.value)" ${adminLock}></label>
                    </div>

                    <!-- Tipografia -->
                    <div style="${adminOp}">
                        <div style="font-size:11px; font-weight:600; margin-bottom:8px;">Tipografia e Ícones</div>
                        <label class="color-row">Texto Principal <input type="color" value="${t.text}" onchange="updateThemeVar('text', this.value)" ${adminLock}></label>
                        <label class="color-row">Texto Secundário <input type="color" value="${t.muted}" onchange="updateThemeVar('muted', this.value)" ${adminLock}></label>
                        <label class="color-row">Acento/Destaque <input type="color" value="${t.accent}" onchange="updateThemeVar('accent', this.value)" ${adminLock}></label>
                    </div>

                    <!-- Status -->
                    <div>
                        <div style="font-size:11px; font-weight:600; margin-bottom:8px; color:var(--accent);">Status (Acesso Livre)</div>
                        <label class="color-row">Ocupado <input type="color" value="${t.occupied}" onchange="updateThemeVar('occupied', this.value)"></label>
                        <label class="color-row">Livre <input type="color" value="${t.available}" onchange="updateThemeVar('available', this.value)"></label>
                        <label class="color-row">Reservado <input type="color" value="${t.reserved}" onchange="updateThemeVar('reserved', this.value)"></label>
                        <label class="color-row">Manutenção <input type="color" value="${t.maintenance}" onchange="updateThemeVar('maintenance', this.value)"></label>
                    </div>
                </div>
            </div>

            <div class="config-section" style="margin-top:20px; border-top:1px solid var(--border); padding-top:20px;">
                <h3>Planta Baixa</h3>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <input type="text" id="bgImgUrl" value="${currentEvent.bgImage.url}" placeholder="URL da imagem..." style="flex:1; padding:8px; border-radius:4px; border:1px solid var(--border); background:var(--surface2); color:var(--text);">
                    <button class="action-btn change-status" onclick="updateBgImage()">Aplicar Imagem</button>
                    <button class="action-btn secondary" onclick="enableBgEditMode()">Ajustar/Modo Edição</button>
                </div>
            </div>
            
            <div class="config-section" style="margin-top:20px;">
                <div class="actions" style="border:none; padding-top:10px;">
                    <button class="action-btn secondary" onclick="manageAreas()">Gerenciar Áreas</button>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="config-section">
                <h3>Preferências Pessoais</h3>
                <p>Usuários básicos possuem acesso limitado às configurações do evento.</p>
            </div>
        `;
    }

    modalBody.innerHTML = html;
    
    document.getElementById('btnCloseConfig').onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if(e.target === modal) modal.classList.add('hidden'); };

    modal.classList.remove('hidden');
}

window.applyPresetTheme = function(themeName) {
    if(currentUser.role !== 'ADMIN') return;
    const newTheme = THEMES[themeName];
    if(newTheme) {
        currentEvent.theme = JSON.parse(JSON.stringify(newTheme));
        applyEventThemeAndFont();
        openConfigModal(); // Re-render para atualizar os color pickers
        renderMap();
        renderList();
        saveEventToFirebase(currentEvent);
    }
}

window.updateThemeVar = function(varName, hexValue) {
    currentEvent.theme[varName] = hexValue;
    applyEventThemeAndFont();
    if(['occupied', 'available', 'reserved', 'maintenance'].includes(varName)) {
        renderMap();
        renderList();
        renderHistory();
        if(selectedBoothId) showDetails(selectedBoothId);
    }
    debouncedSaveEventToFirebase(currentEvent);
}

window.simulateFontUpload = function() {
    alert("Simulação: Upload de arquivo binário .ttf / .woff recebido e salvo na biblioteca de fontes do evento! (Requer backend para aplicar).");
}

window.changeFont = function(fontName) {
    if(currentUser.role !== 'ADMIN') return;
    currentEvent.font = fontName;
    applyEventThemeAndFont();
    saveEventToFirebase(currentEvent);
}

window.updateBgImage = function() {
    const url = document.getElementById('bgImgUrl').value;
    currentEvent.bgImage.url = url;
    renderMapBg();
    saveEventToFirebase(currentEvent);
}

window.enableBgEditMode = function() {
    isBgEditMode = true;
    document.getElementById('configModalOverlay').classList.add('hidden');
    document.getElementById('bgEditModeBanner').classList.remove('hidden');
    selectedBoothId = null;
    document.getElementById('boothDetails').classList.add('hidden');
    renderMap();
}

window.manageAreas = function() {
    const name = prompt('Nova Área (Nome):');
    if(name) {
        const id = 'area_' + Date.now();
        currentEvent.areas.push({ id: id, name: name, x: 100, y: 100, w: 200, h: 200, accent: '#d08010', dim: '#444' });
        renderAreaTabs();
        renderAreas();
        saveEventToFirebase(currentEvent);
        alert('Área criada com sucesso!');
    }
}

function logHistory(boothId, label, action, detail) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    currentEvent.history.unshift({
        id: 'h' + Date.now(),
        boothId: boothId,
        boothLabel: label,
        action: action,
        user: currentUser.name,
        timestamp: `${dateStr} ${timeStr}`,
        detail: detail
    });
    renderHistory();
    saveEventToFirebase(currentEvent);
}

function setupDragAndDrop() {
    let draggedBooth = null;
    let isDraggingBg = false;
    let offset = { x: 0, y: 0 };
    let bgStartPt = { x: 0, y: 0 };
    
    window.isDraggingBooth = false;

    const svg = document.getElementById('mapSvg');

    svg.addEventListener('mousedown', (e) => {
        if (currentUser.role === 'USER') return;

        // Se estiver no modo de desenho de uma nova forma
        if (isBgEditMode && currentDrawMode) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            
            tempDrawStart = { 
                x: (svgP.x - transform.x) / transform.scale, 
                y: (svgP.y - transform.y) / transform.scale 
            };
            return;
        }
        
        // ... (Mantenha o resto do mousedown original de arrastar imagem ou estandes)

        const target = e.target.closest('.svg-booth');
        if (target && !isBgEditMode) {
            e.stopPropagation();
            draggedBooth = currentEvent.booths.find(b => b.id === target.getAttribute('data-id'));
            
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            
            offset.x = (svgP.x - transform.x) / transform.scale - draggedBooth.x;
            offset.y = (svgP.y - transform.y) / transform.scale - draggedBooth.y;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isBgEditMode && isDraggingBg) {
            const dx = (e.clientX - bgStartPt.x) / transform.scale;
            const dy = (e.clientY - bgStartPt.y) / transform.scale;
            currentEvent.bgImage.x += dx;
            currentEvent.bgImage.y += dy;
            bgStartPt = { x: e.clientX, y: e.clientY };
            renderMapBg();
            return;
        }

        if (draggedBooth && !isBgEditMode) {
            window.isDraggingBooth = true;
            
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            
            draggedBooth.x = (svgP.x - transform.x) / transform.scale - offset.x;
            draggedBooth.y = (svgP.y - transform.y) / transform.scale - offset.y;
            // [Adicione estas linhas dentro do mousemove no setupDragAndDrop]
            if (selectedBoothId === draggedBooth.id) {
                document.getElementById('editX').value = Math.round(draggedBooth.x);
                document.getElementById('editY').value = Math.round(draggedBooth.y);
            }
            renderMap();
        }
    });

    window.addEventListener('mouseup', (e) => {
        // --- 1. CÓDIGO EXISTENTE QUE SOLTA O ESTANDE/FUNDO ---
        let changed = false;
        if (draggedBooth) {
            setTimeout(() => { window.isDraggingBooth = false; }, 50);
            draggedBooth = null;
            changed = true;
        }
        if (isDraggingBg) {
            isDraggingBg = false;
            changed = true;
        }
        if (changed && currentEvent) {
            saveEventToFirebase(currentEvent);
        }

        // --- 2. NOVO CÓDIGO QUE FINALIZA O DESENHO ---
        if (isBgEditMode && currentDrawMode && tempDrawStart) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(document.getElementById('mapSvg').getScreenCTM().inverse());
            
            const endX = (svgP.x - transform.x) / transform.scale;
            const endY = (svgP.y - transform.y) / transform.scale;
            
            const width = Math.abs(endX - tempDrawStart.x);
            const height = Math.abs(endY - tempDrawStart.y);
            
            if (width > 5 && height > 5) {
                const startX = Math.min(tempDrawStart.x, endX);
                const startY = Math.min(tempDrawStart.y, endY);
                
                const label = prompt(`Nome/ID para o(a) novo(a) ${currentDrawMode === 'booth' ? 'Estande' : 'Área'}:`);
                
                if (label) {
                    if (currentDrawMode === 'booth') {
                        currentEvent.booths.push({
                            id: 'b_' + Date.now(),
                            label: label.toUpperCase(),
                            x: startX, y: startY, w: width, h: height,
                            status: 'available', rotation: 0, area: 'all'
                        });
                    } else {
                        currentEvent.areas.push({
                            id: 'area_' + Date.now(),
                            name: label,
                            x: startX, y: startY, w: width, h: height,
                            accent: '#d08010', dim: '#444'
                        });
                    }
                    saveEventToFirebase(currentEvent);
                    renderAreas();
                    renderMap();
                    renderList();
                }
            }
            tempDrawStart = null;
            currentDrawMode = null;
        }
    });

    document.getElementById('mapContainer').addEventListener('wheel', (e) => {
        if(isBgEditMode) {
            e.preventDefault();
            if(e.shiftKey) {
                const delta = e.deltaY > 0 ? 2 : -2;
                currentEvent.bgImage.rotation += delta;
            } else {
                const delta = e.deltaY > 0 ? 0.95 : 1.05;
                currentEvent.bgImage.scale *= delta;
            }
            renderMapBg();
            debouncedSaveEventToFirebase(currentEvent);
        }
    });
}

function setupPanZoom() {
    let isDragging = false;
    let startPoint = { x: 0, y: 0 };
    
    const container = document.getElementById('mapContainer');
    
    const updateTransform = () => {
        mapViewport.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    };

    container.addEventListener('wheel', (e) => {
        if(e.shiftKey || isBgEditMode) return; 
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.4, Math.min(3, transform.scale * delta));
        
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
        transform.y = my - (my - transform.y) * (newScale / transform.scale);
        transform.scale = newScale;
        
        updateTransform();
    });

    container.addEventListener('mousedown', (e) => {
        if(isBgEditMode) return;
        if(e.target.closest('.svg-booth') || e.target.closest('.zoom-controls') || e.target.closest('.legend-bottom')) return;
        isDragging = true;
        startPoint = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || isBgEditMode) return;
        transform.x = e.clientX - startPoint.x;
        transform.y = e.clientY - startPoint.y;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
        transform.scale = Math.min(3, transform.scale * 1.2);
        updateTransform();
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
        transform.scale = Math.max(0.4, transform.scale * 0.8);
        updateTransform();
    });
    
    document.getElementById('zoomReset').addEventListener('click', () => {
        transform = { x: 0, y: 0, scale: 1 };
        updateTransform();
    });
}
// --- NOVOS EVENTOS (PASSO 7) ---

// Controle de Opacidade da Imagem de Fundo
document.getElementById('bgOpacityInput').addEventListener('input', (e) => {
    const bgImg = document.getElementById('mapBgImage');
    if(bgImg) {
        bgImg.style.opacity = e.target.value / 100;
    }
});

// Botão de Cadeado
document.getElementById('btnLockToggle').addEventListener('click', () => {
    if(currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') return;
    const booth = currentEvent.booths.find(b => b.id === selectedBoothId);
    if(booth) {
        booth.locked = !booth.locked;
        showDetails(selectedBoothId);
    }
});

// --- NOVAS REGRAS: AUTO-SAVE E PERMISSÕES (PASSO D) ---

// Mostrar botões apenas para Admin/Manager
function updateUIPermissions() {
    const canEditStructure = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
    const btnMap = document.getElementById('btnEditBgMap');
    const btnAreas = document.getElementById('btnEditAreas');
    const btnForm = document.getElementById('btnDrawForm'); // Nosso botão novo
    
    if(btnMap && btnAreas) {
        btnMap.classList.toggle('hidden', !canEditStructure);
        btnAreas.classList.toggle('hidden', !canEditStructure);
    }
    if(btnForm) {
        btnForm.classList.toggle('hidden', !canEditStructure); // Aplica a regra aqui
    }
}

// Lógica do Auto-Save para todos os inputs de edição
const inputsToAutoSave = ['editExhibitor', 'editStatus', 'editExecutive', 'editX', 'editY', 'editRotation'];

inputsToAutoSave.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', (e) => {
            if(!selectedBoothId) return;
            const booth = currentEvent.booths.find(b => b.id === selectedBoothId);
            if(!booth || booth.locked) return;

            const oldStatus = booth.status;

            // Atualiza valores no objeto em tempo real
            if(id === 'editExhibitor') booth.exhibitor = e.target.value;
            if(id === 'editExecutive') booth.executive = e.target.value;
            if(id === 'editStatus') booth.status = e.target.value;
            if(id === 'editX') booth.x = parseFloat(e.target.value) || booth.x;
            if(id === 'editY') booth.y = parseFloat(e.target.value) || booth.y;
            if(id === 'editRotation') booth.rotation = parseFloat(e.target.value) || 0;

            // Log de histórico se mudar o status
            if(id === 'editStatus' && oldStatus !== booth.status) {
                logHistory(booth.id, booth.label, `Status: ${LABELS[booth.status]}`, 'Atualização automática', booth.status);
            }

            renderMap(); 
            renderList();
            renderStats();
            
            if(id === 'editStatus') {
                const badge = document.getElementById('detailStatusBadge');
                badge.innerText = LABELS[booth.status];
                const color = currentEvent.theme[booth.status];
                badge.style.color = color;
                badge.style.backgroundColor = `${color}15`;
                badge.style.borderColor = `${color}44`;
            }
            
            debouncedSaveEventToFirebase(currentEvent);
        });
    }
});

// Ações dos novos botões de mapa/área (certifique-se de que eles existem no seu HTML)
const btnEditBgMap = document.getElementById('btnEditBgMap');
if (btnEditBgMap) btnEditBgMap.addEventListener('click', enableBgEditMode);

const btnEditAreas = document.getElementById('btnEditAreas');
if (btnEditAreas) btnEditAreas.addEventListener('click', manageAreas);

// --- GERENCIAMENTO DE EVENTOS (ADMIN) ---
window.toggleEventVisibility = async function(id) {
    if (currentUser.role !== 'ADMIN') return;
    const evt = EVENTS_DB.find(e => e.id === id);
    if (evt) {
        evt.visible = evt.visible === false ? true : false;
        await saveEventToFirebase(evt);
        renderTopBar();
        openConfigModal(); // Recarrega o modal para atualizar o botão
    }
}

window.deleteEvent = async function(id) {
    if (currentUser.role !== 'ADMIN') return;
    const confirmDelete = confirm("ATENÇÃO: Tem certeza que deseja excluir permanentemente este evento e todos os seus dados?");
    if (confirmDelete) {
        try {
            await deleteDoc(doc(window.db, "events", id));
            alert("Evento excluído com sucesso.");
            // Recarrega a página para atualizar o estado do Firebase
            window.location.reload(); 
        } catch (err) {
            console.error("Erro ao excluir evento:", err);
            alert("Falha ao excluir. Verifique suas permissões no Firestore.");
        }
    }
}