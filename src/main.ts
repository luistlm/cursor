import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./styles.css";

(pdfjsLib as typeof pdfjsLib & { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
  pdfWorker;

type Tab = "main" | "income" | "spending" | "savings";
type Currency = "ARS" | "USD" | "USDC";
type Direction = "income" | "expense";
type ThemeMode = "system" | "light" | "dark";
type Recurrence = "once" | "monthly" | "biweekly" | "weekly";

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  currency: Currency;
  direction: Direction;
  category: string;
  source: "statement" | "manual" | "whatsapp";
  recurrence?: Recurrence;
}

interface PendingTransaction extends Transaction {
  approved: boolean;
}

interface PendingImport {
  id: string;
  name: string;
  createdAt: string;
  volume: number;
  transactions: PendingTransaction[];
}

interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  currency: Currency;
  deadline?: string;
  isDefault?: boolean;
}

interface SavingsContribution {
  id: string;
  date: string;
  goalId: string;
  amount: number;
  currency: Currency;
  reason: string;
}

interface WalletBalance {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
}

interface SavingsRules {
  roundUp: boolean;
  retentionPercent: number;
  defaultGoalId: string;
}

interface ExchangeRates {
  base: Currency;
  usdToArs: number;
  updatedAt: string;
  status: string;
}

interface AppState {
  activeTab: Tab;
  theme: ThemeMode;
  selectedCategory: string | null;
  visibleExpenseCount: number;
  showIncomeForm: boolean;
  transactions: Transaction[];
  pendingImports: PendingImport[];
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
  balances: WalletBalance[];
  rules: SavingsRules;
  rates: ExchangeRates;
}

interface PieSlice {
  category: string;
  amount: number;
  start: number;
  end: number;
}

const STORAGE_KEY = "freemoney-state-v1";
const currencies: Currency[] = ["ARS", "USD", "USDC"];
const tabs: Array<{ id: Tab; label: string; subtitle: string }> = [
  { id: "main", label: "Main", subtitle: "Financial health snapshot" },
  { id: "income", label: "Income", subtitle: "Incoming money control" },
  { id: "spending", label: "Spending", subtitle: "Expense audit and WhatsApp bot" },
  { id: "savings", label: "Savings", subtitle: "Goals, rules, and wallet" },
];

const expenseCategoryWords: Record<string, string[]> = {
  Food: ["coffee", "restaurant", "dinner", "lunch", "grocery", "market", "super", "comida", "cafe", "cena"],
  Utilities: ["electric", "water", "gas", "internet", "phone", "luz", "agua", "servicio"],
  Entertainment: ["cinema", "movie", "concert", "game", "bar", "friends", "teatro", "salida"],
  Transportation: ["uber", "taxi", "bus", "train", "subway", "fuel", "gasoline", "nafta", "subte"],
  "Music/Subscriptions": ["spotify", "netflix", "software", "subscription", "saas", "music", "suscripcion"],
  Shopping: ["store", "shop", "amazon", "mercado", "hardware", "clothes", "ropa"],
};

const incomeCategoryWords: Record<string, string[]> = {
  Salary: ["salary", "payroll", "sueldo", "nomina", "haberes"],
  Freelance: ["freelance", "invoice", "client", "honorarios"],
  Rent: ["rent", "rental", "alquiler"],
  Royalties: ["royalty", "royalties", "regalias"],
};

let state: AppState = loadState();
let pieSlices: PieSlice[] = [];

applyTheme();
render();

function loadState(): AppState {
  const saved = readStoredState();
  if (saved) {
    try {
      return JSON.parse(saved) as AppState;
    } catch {
      removeStoredState();
    }
  }

  const current = new Date();
  const lastMonth = new Date(current.getFullYear(), current.getMonth() - 1, 14);
  const goalId = uid("goal");

  const seedTransactions: Transaction[] = [
    tx("income", "Salary ACME Payroll", 1800, "USD", "Salary", "statement", isoFor(current, 1), "monthly"),
    tx("income", "Freelance invoice Studio Norte", 350000, "ARS", "Freelance", "statement", isoFor(current, 5), "once"),
    tx("expense", "Supermercado Central", 42000, "ARS", "Food", "statement", isoFor(current, 6)),
    tx("expense", "Spotify subscription", 7.99, "USD", "Music/Subscriptions", "statement", isoFor(current, 7)),
    tx("expense", "Uber ride", 9200, "ARS", "Transportation", "whatsapp", isoFor(current, 8)),
    tx("expense", "Electric utility bill", 24000, "ARS", "Utilities", "statement", isoFor(current, 9)),
    tx("expense", "Dinner friends", 12000, "ARS", "Entertainment", "manual", isoFor(current, 10)),
    tx("income", "Previous salary", 1750, "USD", "Salary", "statement", isoFor(lastMonth, 1), "monthly"),
    tx("expense", "Previous groceries", 39000, "ARS", "Food", "statement", isoFor(lastMonth, 4)),
  ];

  return {
    activeTab: "main",
    theme: "system",
    selectedCategory: null,
    visibleExpenseCount: 12,
    showIncomeForm: false,
    transactions: seedTransactions,
    pendingImports: [],
    goals: [
      {
        id: goalId,
        name: "Emergency Fund",
        target: 5000,
        saved: 1350,
        currency: "USD",
        deadline: isoFor(new Date(current.getFullYear(), current.getMonth() + 6, 1), 1),
        isDefault: true,
      },
      {
        id: uid("goal"),
        name: "Hardware / New Instruments",
        target: 2500000,
        saved: 420000,
        currency: "ARS",
      },
    ],
    contributions: [
      contribution(goalId, 420, "USD", isoFor(lastMonth, 3), "Pay yourself first"),
      contribution(goalId, 180, "USD", isoFor(current, 4), "Round-up and retention rules"),
    ],
    balances: [
      { id: uid("bal"), label: "Checking account", amount: 520000, currency: "ARS" },
      { id: uid("bal"), label: "Dollar savings", amount: 1450, currency: "USD" },
      { id: uid("bal"), label: "Stablecoin wallet", amount: 320, currency: "USDC" },
    ],
    rules: {
      roundUp: true,
      retentionPercent: 10,
      defaultGoalId: goalId,
    },
    rates: {
      base: "ARS",
      usdToArs: 1100,
      updatedAt: new Date().toISOString(),
      status: "Fallback rate loaded. Press Update rates for live market data.",
    },
  };
}

function tx(
  direction: Direction,
  description: string,
  amount: number,
  currency: Currency,
  category: string,
  source: Transaction["source"],
  date: string,
  recurrence?: Recurrence,
): Transaction {
  return {
    id: uid("tx"),
    date,
    description,
    merchant: description,
    amount,
    currency,
    direction,
    category,
    source,
    recurrence,
  };
}

function contribution(
  goalId: string,
  amount: number,
  currency: Currency,
  date: string,
  reason: string,
): SavingsContribution {
  return { id: uid("sav"), goalId, amount, currency, date, reason };
}

function saveState() {
  writeStoredState(JSON.stringify(state));
}

function render() {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const tab = tabs.find((item) => item.id === state.activeTab) ?? tabs[0];
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">freemoney</p>
          <h1>${tab.label}</h1>
          <p>${tab.subtitle}</p>
        </div>
        <label class="theme-control">
          Theme
          <select id="theme-select" aria-label="Theme mode">
            <option value="system" ${selected(state.theme, "system")}>System</option>
            <option value="light" ${selected(state.theme, "light")}>Light</option>
            <option value="dark" ${selected(state.theme, "dark")}>Dark OLED</option>
          </select>
        </label>
      </header>
      <main class="content">
        ${renderActiveTab()}
      </main>
      <nav class="bottom-nav" aria-label="Primary">
        ${tabs
          .map(
            (item) => `
              <button class="${item.id === state.activeTab ? "active" : ""}" data-tab="${item.id}">
                <span>${item.label}</span>
              </button>
            `,
          )
          .join("")}
      </nav>
    </div>
  `;

  bindEvents();
  requestAnimationFrame(() => {
    drawPieChart();
    drawSavingsLineChart();
  });
}

function renderActiveTab() {
  if (state.activeTab === "main") return renderMainTab();
  if (state.activeTab === "income") return renderIncomeTab();
  if (state.activeTab === "spending") return renderSpendingTab();
  return renderSavingsTab();
}

function renderMainTab() {
  const currentIncome = groupByCategory(currentMonthTransactions("income"));
  const selectedExpense = state.selectedCategory ? monthlyExpenseByCategory().find((item) => item.category === state.selectedCategory) : null;
  const totalExpense = monthlyExpenseByCategory().reduce((sum, item) => sum + item.baseAmount, 0);
  const currentSavings = totalSavingsInBase();
  const thisMonthSaved = savingsForMonth(monthKey(new Date()));
  const previousMonthSaved = savingsForMonth(monthKey(addMonths(new Date(), -1)));
  const savingsDelta = thisMonthSaved - previousMonthSaved;

  return `
    <section class="grid two">
      <article class="card hero-card">
        <p class="eyebrow">Current month income</p>
        <h2>${formatBase(totalIncomeThisMonth())}</h2>
        <div class="breakdown-list">
          ${Object.entries(currentIncome)
            .map(
              ([category, amount]) => `
                <div>
                  <span>${escapeHtml(category)}</span>
                  <strong>${formatBase(amount)}</strong>
                </div>
              `,
            )
            .join("") || `<p class="muted">No income detected this month yet.</p>`}
        </div>
      </article>
      <article class="card savings-card">
        <p class="eyebrow">Savings summary</p>
        <h2>${formatBase(currentSavings)}</h2>
        <p class="${savingsDelta >= 0 ? "positive" : "negative"}">
          ${savingsDelta >= 0 ? "+" : ""}${formatBase(savingsDelta)} compared with previous month
        </p>
        <div class="mini-grid">
          <span>This month</span><strong>${formatBase(thisMonthSaved)}</strong>
          <span>Previous month</span><strong>${formatBase(previousMonthSaved)}</strong>
        </div>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Monthly expense graph</p>
            <h2>Expenses by category</h2>
          </div>
          <span class="pill">Tap slices</span>
        </div>
        <canvas id="expense-pie" width="360" height="300" aria-label="Expense pie chart"></canvas>
        <div class="chart-detail">
          ${
            selectedExpense
              ? `<strong>${escapeHtml(selectedExpense.category)}:</strong> ${formatBase(selectedExpense.baseAmount)} (${percent(
                  selectedExpense.baseAmount,
                  totalExpense,
                )})`
              : "Select a slice to reveal amount and percentage."
          }
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Statement processing engine</p>
            <h2>Import PDF or text</h2>
          </div>
          <span class="pill">English + Spanish</span>
        </div>
        ${renderStatementImport()}
      </article>
    </section>

    ${renderPendingImports()}
  `;
}

function renderStatementImport() {
  return `
    <form id="statement-form" class="stack">
      <label>
        PDF, TXT, or CSV statement
        <input id="statement-file" type="file" accept=".pdf,.txt,.csv,text/plain,application/pdf" />
      </label>
      <label>
        Or paste statement text
        <textarea name="statementText" rows="7" placeholder="05/06/2026 Compra Supermercado Central -42.000,00 ARS&#10;2026-06-05 Payroll ACME 1800 USD credit"></textarea>
      </label>
      <button type="submit" class="primary">Detect transactions</button>
      <p class="muted">
        The parser identifies date, merchant/description, amount, currency, and debit/credit movement before asking for approval.
      </p>
    </form>
  `;
}

function renderPendingImports() {
  if (!state.pendingImports.length) return "";

  return `
    <section class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Intermediate approval stage</p>
          <h2>Review detected transactions</h2>
        </div>
        <span class="pill">${state.pendingImports.length} import${state.pendingImports.length > 1 ? "s" : ""}</span>
      </div>
      ${state.pendingImports
        .map(
          (item) => `
            <div class="review-block">
              <div class="review-header">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <p class="muted">${item.transactions.length} movements, total volume ${formatBase(item.volume)}</p>
                </div>
                <button class="primary" data-approve-import="${item.id}">Approve checked</button>
              </div>
              <div class="review-list">
                ${item.transactions
                  .map(
                    (txItem) => `
                      <label class="review-row">
                        <input type="checkbox" ${txItem.approved ? "checked" : ""} data-pending="${item.id}" data-pending-tx="${txItem.id}" />
                        <span>${formatShortDate(txItem.date)}</span>
                        <span>${escapeHtml(txItem.description)}</span>
                        <span>${escapeHtml(txItem.category)}</span>
                        <strong class="${txItem.direction === "income" ? "positive" : "negative"}">
                          ${txItem.direction === "income" ? "+" : "-"}${formatMoney(txItem.amount, txItem.currency)}
                        </strong>
                      </label>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderIncomeTab() {
  const incomes = [...state.transactions]
    .filter((item) => item.direction === "income")
    .sort((a, b) => b.date.localeCompare(a.date));
  const grouped = groupTransactionsByCategory(incomes);

  return `
    <section class="grid two">
      <article class="card">
        <p class="eyebrow">Accumulated current month</p>
        <h2>${formatBase(totalIncomeThisMonth())}</h2>
        <div class="breakdown-list">
          ${Object.entries(groupByCategory(currentMonthTransactions("income")))
            .map(([category, amount]) => `<div><span>${escapeHtml(category)}</span><strong>${formatBase(amount)}</strong></div>`)
            .join("") || `<p class="muted">Add or import income to start tracking.</p>`}
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Manual income</p>
            <h2>Advanced entry</h2>
          </div>
          <button class="fab-inline" id="toggle-income-form">${state.showIncomeForm ? "Close" : "Add income"}</button>
        </div>
        ${state.showIncomeForm ? renderIncomeForm() : `<p class="muted">Use the floating action button for cash, bonuses, sales, or other off-bank income.</p>`}
      </article>
    </section>

    <section class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Income sources list</p>
          <h2>Chronological and categorized</h2>
        </div>
        <span class="pill">${incomes.length} entries</span>
      </div>
      <div class="source-columns">
        ${Object.entries(grouped)
          .map(
            ([category, items]) => `
              <div class="source-group">
                <h3>${escapeHtml(category)}</h3>
                ${items.map(renderTransactionRow).join("")}
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <button class="fab" id="fab-income" aria-label="Add income">+</button>
  `;
}

function renderIncomeForm() {
  return `
    <form id="income-form" class="stack compact-form">
      <div class="form-grid">
        <label>Amount<input required name="amount" type="number" min="0.01" step="0.01" /></label>
        <label>Currency${currencySelect("currency", "ARS")}</label>
      </div>
      <label>Description<input required name="description" placeholder="Salary, cash sale, royalties" /></label>
      <div class="form-grid">
        <label>Category<input name="category" placeholder="Salary" /></label>
        <label>Date<input required name="date" type="date" value="${todayIso()}" /></label>
      </div>
      <label>
        Recurrence
        <select name="recurrence">
          <option value="once">This month only</option>
          <option value="monthly">Recurrent - monthly</option>
          <option value="biweekly">Recurrent - biweekly</option>
          <option value="weekly">Recurrent - weekly</option>
        </select>
      </label>
      <button class="primary" type="submit">Save income</button>
    </form>
  `;
}

function renderSpendingTab() {
  const expenses = [...state.transactions]
    .filter((item) => item.direction === "expense")
    .sort((a, b) => b.date.localeCompare(a.date));
  const visible = expenses.slice(0, state.visibleExpenseCount);

  return `
    <section class="grid two">
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Traditional manual entry</p>
            <h2>Log an expense</h2>
          </div>
          <span class="pill">Quick form</span>
        </div>
        <form id="expense-form" class="stack compact-form">
          <div class="form-grid">
            <label>Amount<input required name="amount" type="number" min="0.01" step="0.01" /></label>
            <label>Currency${currencySelect("currency", "ARS")}</label>
          </div>
          <div class="form-grid">
            <label>Category<input required name="category" placeholder="Food" /></label>
            <label>Date<input required name="date" type="date" value="${todayIso()}" /></label>
          </div>
          <label>Optional description<input name="description" placeholder="Coffee with team" /></label>
          <button class="primary" type="submit">Add expense</button>
        </form>
      </article>
      <article class="card whatsapp-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">WhatsApp bot integration</p>
            <h2>Send a regular text</h2>
          </div>
          <span class="status-dot">Connected</span>
        </div>
        <div class="phone-frame">
          <p class="bot-message">Try: "1500 coffee", "Dinner friends 12000", or "Software subscription 15 usd".</p>
          <form id="whatsapp-form" class="chat-input">
            <input required name="message" placeholder="Type expense message" />
            <button type="submit">Send</button>
          </form>
        </div>
      </article>
    </section>

    <section class="card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Detailed transaction history</p>
          <h2>Newest to oldest</h2>
        </div>
        <span class="pill">${visible.length} of ${expenses.length}</span>
      </div>
      <div class="transaction-list">
        ${visible.map(renderTransactionRow).join("") || `<p class="muted">No expenses yet.</p>`}
      </div>
      ${visible.length < expenses.length ? `<button class="ghost full" id="load-expenses">Load older expenses</button>` : ""}
    </section>
  `;
}

function renderSavingsTab() {
  const totalBase = totalSavingsInBase();
  const defaultGoal = state.goals.find((goal) => goal.id === state.rules.defaultGoalId);

  return `
    <section class="grid two">
      <article class="card hero-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Unified wallet</p>
            <h2>${formatBase(totalBase)}</h2>
          </div>
          <button class="ghost" id="refresh-rates">Update rates</button>
        </div>
        <div class="wallet-list">
          ${state.balances
            .map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${formatMoney(item.amount, item.currency)}</strong></div>`)
            .join("")}
          ${state.goals
            .map((goal) => `<div><span>${escapeHtml(goal.name)} goal</span><strong>${formatMoney(goal.saved, goal.currency)}</strong></div>`)
            .join("")}
        </div>
        <p class="muted">${escapeHtml(state.rates.status)} Last update: ${formatDateTime(state.rates.updatedAt)}</p>
        <label class="inline-control">
          Base currency
          ${currencySelect("base-currency", state.rates.base)}
        </label>
      </article>
      <article class="card">
        <p class="eyebrow">Historical evolution</p>
        <h2>Savings growth</h2>
        <canvas id="savings-line" width="420" height="260" aria-label="Savings evolution line chart"></canvas>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Personalized savings goals</p>
            <h2>Virtual piggy banks</h2>
          </div>
          <span class="pill">${state.goals.length} goals</span>
        </div>
        <div class="goal-list">
          ${state.goals.map(renderGoal).join("")}
        </div>
        <form id="goal-form" class="stack compact-form">
          <h3>Create goal</h3>
          <label>Name<input required name="name" placeholder="Vacation" /></label>
          <div class="form-grid">
            <label>Target<input required name="target" type="number" min="0.01" step="0.01" /></label>
            <label>Currency${currencySelect("currency", "ARS")}</label>
          </div>
          <label>Deadline (optional)<input name="deadline" type="date" /></label>
          <button class="primary" type="submit">Create savings goal</button>
        </form>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Smart savings</p>
            <h2>Automated rules</h2>
          </div>
          <span class="pill">Default: ${escapeHtml(defaultGoal?.name ?? "None")}</span>
        </div>
        <form id="rules-form" class="stack compact-form">
          <label class="switch-row">
            <span>
              Round-up mode
              <small>If an expense is 4.50, freemoney simulates 5.00 and saves 0.50.</small>
            </span>
            <input name="roundUp" type="checkbox" ${state.rules.roundUp ? "checked" : ""} />
          </label>
          <label>
            Pay Yourself First retention percentage
            <input name="retentionPercent" type="number" min="0" max="90" step="1" value="${state.rules.retentionPercent}" />
          </label>
          <label>
            Default savings goal
            <select name="defaultGoalId">
              ${state.goals.map((goal) => `<option value="${goal.id}" ${selected(state.rules.defaultGoalId, goal.id)}>${escapeHtml(goal.name)}</option>`).join("")}
            </select>
          </label>
          <button class="primary" type="submit">Save rules</button>
        </form>
        <div class="rule-preview">
          <strong>Rule preview</strong>
          <p>Next ${formatMoney(1000, state.rates.base)} income pre-allocates ${formatMoney(1000 * (state.rules.retentionPercent / 100), state.rates.base)} to savings.</p>
        </div>
      </article>
    </section>
  `;
}

function renderGoal(goal: SavingsGoal) {
  const progress = Math.min(100, (goal.saved / goal.target) * 100);
  const remaining = Math.max(0, goal.target - goal.saved);

  return `
    <article class="goal-card">
      <div class="section-heading">
        <div>
          <h3>${escapeHtml(goal.name)} ${goal.isDefault ? `<span class="pill">Default</span>` : ""}</h3>
          <p class="muted">${goal.deadline ? `Deadline ${formatShortDate(goal.deadline)}` : "No deadline"}</p>
        </div>
        <strong>${Math.round(progress)}%</strong>
      </div>
      <div class="progress"><span style="width: ${progress}%"></span></div>
      <div class="mini-grid">
        <span>Saved</span><strong>${formatMoney(goal.saved, goal.currency)}</strong>
        <span>Remaining</span><strong>${formatMoney(remaining, goal.currency)}</strong>
      </div>
    </article>
  `;
}

function renderTransactionRow(item: Transaction) {
  return `
    <article class="transaction-row">
      <div class="category-icon">${escapeHtml(item.category.slice(0, 2).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(item.description)}</strong>
        <p>${formatShortDate(item.date)} · ${escapeHtml(item.category)} · ${escapeHtml(item.source)}${item.recurrence ? ` · ${recurrenceLabel(item.recurrence)}` : ""}</p>
      </div>
      <strong class="${item.direction === "income" ? "positive" : "negative"}">
        ${item.direction === "income" ? "+" : "-"}${formatMoney(item.amount, item.currency)}
      </strong>
    </article>
  `;
}

function bindEvents() {
  document.querySelector<HTMLSelectElement>("#theme-select")?.addEventListener("change", (event) => {
    state.theme = (event.currentTarget as HTMLSelectElement).value as ThemeMode;
    saveState();
    applyTheme();
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab as Tab;
      state.visibleExpenseCount = state.activeTab === "spending" ? state.visibleExpenseCount : 12;
      saveState();
      render();
    });
  });

  document.querySelector<HTMLCanvasElement>("#expense-pie")?.addEventListener("click", handlePieClick);
  document.querySelector<HTMLFormElement>("#statement-form")?.addEventListener("submit", handleStatementSubmit);
  document.querySelector<HTMLInputElement>("#statement-file")?.addEventListener("change", handleStatementFile);
  document.querySelector<HTMLButtonElement>("#toggle-income-form")?.addEventListener("click", toggleIncomeForm);
  document.querySelector<HTMLButtonElement>("#fab-income")?.addEventListener("click", toggleIncomeForm);
  document.querySelector<HTMLFormElement>("#income-form")?.addEventListener("submit", handleIncomeSubmit);
  document.querySelector<HTMLFormElement>("#expense-form")?.addEventListener("submit", handleExpenseSubmit);
  document.querySelector<HTMLFormElement>("#whatsapp-form")?.addEventListener("submit", handleWhatsappSubmit);
  document.querySelector<HTMLButtonElement>("#load-expenses")?.addEventListener("click", () => {
    state.visibleExpenseCount += 10;
    saveState();
    render();
  });
  document.querySelector<HTMLFormElement>("#goal-form")?.addEventListener("submit", handleGoalSubmit);
  document.querySelector<HTMLFormElement>("#rules-form")?.addEventListener("submit", handleRulesSubmit);
  document.querySelector<HTMLButtonElement>("#refresh-rates")?.addEventListener("click", refreshRates);
  document.querySelector<HTMLSelectElement>('select[name="base-currency"]')?.addEventListener("change", (event) => {
    state.rates.base = (event.currentTarget as HTMLSelectElement).value as Currency;
    saveState();
    render();
  });

  document.querySelectorAll<HTMLInputElement>("[data-pending][data-pending-tx]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const importId = checkbox.dataset.pending;
      const txId = checkbox.dataset.pendingTx;
      const pending = state.pendingImports.find((item) => item.id === importId);
      const transaction = pending?.transactions.find((item) => item.id === txId);
      if (transaction) {
        transaction.approved = checkbox.checked;
        saveState();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-approve-import]").forEach((button) => {
    button.addEventListener("click", () => approveImport(button.dataset.approveImport ?? ""));
  });

  window.onscroll = () => {
    if (state.activeTab !== "spending") return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 220;
    if (nearBottom) {
      const totalExpenses = state.transactions.filter((item) => item.direction === "expense").length;
      if (state.visibleExpenseCount < totalExpenses) {
        state.visibleExpenseCount += 10;
        saveState();
        render();
      }
    }
  };
}

function toggleIncomeForm() {
  state.showIncomeForm = !state.showIncomeForm;
  saveState();
  render();
}

async function handleStatementFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? await extractPdfText(file)
      : await file.text();
    addPendingImport(file.name, text);
  } catch (error) {
    alert(`Could not read statement: ${String(error)}`);
  }
}

function handleStatementSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const text = String(form.get("statementText") ?? "").trim();
  if (!text) {
    alert("Paste statement text or choose a statement file first.");
    return;
  }
  addPendingImport("Pasted statement", text);
}

function addPendingImport(name: string, text: string) {
  const parsed = parseStatementText(text);
  if (!parsed.length) {
    alert("No transactions were detected. Try a statement with one movement per line and visible dates/amounts.");
    return;
  }

  const volume = parsed.reduce((sum, item) => sum + convertToBase(item.amount, item.currency), 0);
  state.pendingImports.unshift({
    id: uid("import"),
    name,
    createdAt: new Date().toISOString(),
    volume,
    transactions: parsed.map((item) => ({ ...item, approved: true })),
  });
  saveState();
  state.activeTab = "main";
  render();
}

async function extractPdfText(file: File) {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

function approveImport(importId: string) {
  const pending = state.pendingImports.find((item) => item.id === importId);
  if (!pending) return;

  const approved = pending.transactions.filter((item) => item.approved).map(stripApproval);
  approved.forEach((item) => {
    state.transactions.unshift(item);
    applySavingsRules(item);
  });
  state.pendingImports = state.pendingImports.filter((item) => item.id !== importId);
  saveState();
  render();
}

function stripApproval(item: PendingTransaction): Transaction {
  const { approved: _approved, ...transaction } = item;
  return transaction;
}

function handleIncomeSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const amount = Number(form.get("amount"));
  const currency = String(form.get("currency")) as Currency;
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || inferCategory(description, "income");
  const date = String(form.get("date") || todayIso());
  const recurrence = String(form.get("recurrence") || "once") as Recurrence;

  addTransaction({
    id: uid("tx"),
    amount,
    currency,
    description,
    merchant: description,
    category,
    date,
    direction: "income",
    recurrence,
    source: "manual",
  });
  state.showIncomeForm = false;
  saveState();
  render();
}

function handleExpenseSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const amount = Number(form.get("amount"));
  const currency = String(form.get("currency")) as Currency;
  const category = String(form.get("category") ?? "Other").trim();
  const description = String(form.get("description") ?? "").trim() || category;
  const date = String(form.get("date") || todayIso());

  addTransaction({
    id: uid("tx"),
    amount,
    currency,
    description,
    merchant: description,
    category,
    date,
    direction: "expense",
    source: "manual",
  });
  saveState();
  render();
}

function handleWhatsappSubmit(event: SubmitEvent) {
  event.preventDefault();
  const formEl = event.currentTarget as HTMLFormElement;
  const form = new FormData(formEl);
  const message = String(form.get("message") ?? "").trim();
  const parsed = parseWhatsappMessage(message);
  if (!parsed) {
    alert("I could not find an amount. Try '1500 coffee' or 'Software subscription 15 usd'.");
    return;
  }

  addTransaction(parsed);
  formEl.reset();
  state.activeTab = "spending";
  saveState();
  render();
}

function handleGoalSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const currency = String(form.get("currency")) as Currency;
  const goal: SavingsGoal = {
    id: uid("goal"),
    name: String(form.get("name") ?? "").trim(),
    target: Number(form.get("target")),
    saved: 0,
    currency,
    deadline: String(form.get("deadline") || "") || undefined,
    isDefault: state.goals.length === 0,
  };

  state.goals.push(goal);
  if (!state.rules.defaultGoalId) state.rules.defaultGoalId = goal.id;
  saveState();
  render();
}

function handleRulesSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const defaultGoalId = String(form.get("defaultGoalId"));
  state.rules = {
    roundUp: form.get("roundUp") === "on",
    retentionPercent: Number(form.get("retentionPercent") ?? 0),
    defaultGoalId,
  };
  state.goals = state.goals.map((goal) => ({ ...goal, isDefault: goal.id === defaultGoalId }));
  saveState();
  render();
}

async function refreshRates() {
  state.rates.status = "Updating live rates...";
  saveState();
  render();

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { rates?: { ARS?: number }; time_last_update_utc?: string };
    if (!data.rates?.ARS) throw new Error("ARS rate unavailable");
    state.rates.usdToArs = data.rates.ARS;
    state.rates.updatedAt = data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString() : new Date().toISOString();
    state.rates.status = "Live market exchange rate loaded. USDC is treated as USD-pegged.";
  } catch (error) {
    state.rates.status = `Live rate unavailable; keeping fallback. ${String(error)}`;
  }

  saveState();
  render();
}

function addTransaction(item: Transaction) {
  state.transactions.unshift(item);
  applySavingsRules(item);
}

function applySavingsRules(item: Transaction) {
  if (!state.rules.defaultGoalId) return;
  const goal = state.goals.find((candidate) => candidate.id === state.rules.defaultGoalId);
  if (!goal) return;

  if (item.direction === "expense" && state.rules.roundUp) {
    const rounded = Math.ceil(item.amount);
    const difference = Number((rounded - item.amount).toFixed(2));
    if (difference > 0) addSavingsToGoal(goal, difference, item.currency, item.date, "Round-up mode");
  }

  if (item.direction === "income" && state.rules.retentionPercent > 0) {
    const amount = item.amount * (state.rules.retentionPercent / 100);
    if (amount > 0) addSavingsToGoal(goal, amount, item.currency, item.date, "Pay Yourself First");
  }
}

function addSavingsToGoal(goal: SavingsGoal, amount: number, currency: Currency, date: string, reason: string) {
  const converted = convertCurrency(amount, currency, goal.currency);
  goal.saved = Number((goal.saved + converted).toFixed(2));
  state.contributions.push(contribution(goal.id, converted, goal.currency, date, reason));
}

function parseStatementText(text: string): Transaction[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseStatementLine)
    .filter((item): item is Transaction => Boolean(item));
}

function parseStatementLine(line: string): Transaction | null {
  const dateMatch = line.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
  const amountMatches = [...line.matchAll(/(?:ARS|USD|USDC|\$)?\s*-?\(?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\)?\s*(?:ARS|USD|USDC|cr|dr|credit|debit)?/gi)]
    .map((match) => match[0].trim())
    .filter((raw) => /\d/.test(raw));
  const amountRaw = amountMatches.at(-1);
  if (!dateMatch || !amountRaw) return null;

  const amount = parseAmount(amountRaw);
  if (!amount || Number.isNaN(amount.value)) return null;
  const date = normalizeDate(dateMatch[1]);
  const direction = inferDirection(line, amount.value);
  const currency = inferCurrency(line, amountRaw);
  const cleanedDescription = line
    .replace(dateMatch[0], "")
    .replace(amountRaw, "")
    .replace(/\b(ARS|USD|USDC|cr|dr|credit|debit|debito|credito)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const description = cleanedDescription || "Imported movement";

  return {
    id: uid("tx"),
    date,
    description,
    merchant: description,
    amount: Math.abs(amount.value),
    currency,
    direction,
    category: inferCategory(description, direction),
    source: "statement",
  };
}

function parseWhatsappMessage(message: string): Transaction | null {
  const amountMatch = message.match(/(?:ARS|USD|USDC|\$)?\s*\d+(?:[.,]\d{1,2})?\s*(?:ARS|USD|USDC|usd|ars|usdc)?/i);
  if (!amountMatch) return null;
  const parsed = parseAmount(amountMatch[0]);
  if (!parsed) return null;
  const currency = inferCurrency(message, amountMatch[0]);
  const description = message.replace(amountMatch[0], "").replace(/\b(ars|usd|usdc)\b/gi, "").trim() || "WhatsApp expense";

  return {
    id: uid("tx"),
    date: todayIso(),
    description,
    merchant: description,
    amount: Math.abs(parsed.value),
    currency,
    direction: "expense",
    category: inferCategory(description, "expense"),
    source: "whatsapp",
  };
}

function parseAmount(raw: string): { value: number } | null {
  const negative = /-|\(.+\)|\b(dr|debit|debito)\b/i.test(raw);
  const onlyNumber = raw
    .replace(/\b(ARS|USD|USDC|cr|dr|credit|debit|credito|debito)\b/gi, "")
    .replace(/[$\s()]/g, "")
    .replace(/^-/, "");
  if (!onlyNumber) return null;

  const comma = onlyNumber.lastIndexOf(",");
  const dot = onlyNumber.lastIndexOf(".");
  let normalized = onlyNumber;
  if (comma > -1 && dot > -1) {
    normalized = comma > dot ? onlyNumber.replace(/\./g, "").replace(",", ".") : onlyNumber.replace(/,/g, "");
  } else if (comma > -1) {
    const decimals = onlyNumber.length - comma - 1;
    normalized = decimals <= 2 ? onlyNumber.replace(",", ".") : onlyNumber.replace(/,/g, "");
  } else if (dot > -1) {
    const decimals = onlyNumber.length - dot - 1;
    normalized = decimals <= 2 ? onlyNumber : onlyNumber.replace(/\./g, "");
  }

  const value = Number(normalized);
  return { value: negative ? -value : value };
}

function inferDirection(line: string, amount: number): Direction {
  if (amount < 0) return "expense";
  if (/\b(cr|credit|credito|deposit|deposito|acreditacion|salary|sueldo|payroll|income|ingreso|abono)\b/i.test(line)) return "income";
  if (/\b(dr|debit|debito|purchase|compra|retiro|withdrawal|payment|pago|consumo|cargo)\b/i.test(line)) return "expense";
  return "expense";
}

function inferCurrency(line: string, amountRaw: string): Currency {
  const sample = `${amountRaw} ${line}`.toUpperCase();
  if (/\bUSDC\b/.test(sample)) return "USDC";
  if (/\bUSD\b/.test(sample)) return "USD";
  return "ARS";
}

function inferCategory(text: string, direction: Direction) {
  const dictionaries = direction === "income" ? incomeCategoryWords : expenseCategoryWords;
  const lowered = text.toLowerCase();
  const found = Object.entries(dictionaries).find(([, words]) => words.some((word) => lowered.includes(word)));
  if (found) return found[0];
  return direction === "income" ? "Other income" : "Other";
}

function drawPieChart() {
  const canvas = document.querySelector<HTMLCanvasElement>("#expense-pie");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const data = monthlyExpenseByCategory();
  const total = data.reduce((sum, item) => sum + item.baseAmount, 0);
  const colors = ["#4f46e5", "#0ea5e9", "#10b981", "#f97316", "#ec4899", "#f59e0b", "#64748b"];

  context.clearRect(0, 0, canvas.width, canvas.height);
  pieSlices = [];
  if (!total) {
    context.fillStyle = chartTextColor();
    context.font = "16px Inter, sans-serif";
    context.fillText("No expenses this month.", 92, 150);
    return;
  }

  let start = -Math.PI / 2;
  data.forEach((item, index) => {
    const angle = (item.baseAmount / total) * Math.PI * 2;
    const end = start + angle;
    context.beginPath();
    context.moveTo(150, 145);
    context.arc(150, 145, 100, start, end);
    context.closePath();
    context.fillStyle = colors[index % colors.length];
    context.fill();
    pieSlices.push({ category: item.category, amount: item.baseAmount, start, end });
    start = end;
  });

  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
  context.beginPath();
  context.arc(150, 145, 52, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = chartTextColor();
  context.font = "700 18px Inter, sans-serif";
  context.textAlign = "center";
  context.fillText(formatBase(total), 150, 150);
  context.textAlign = "left";

  data.forEach((item, index) => {
    const y = 46 + index * 28;
    context.fillStyle = colors[index % colors.length];
    context.fillRect(285, y - 12, 12, 12);
    context.fillStyle = chartTextColor();
    context.font = "13px Inter, sans-serif";
    context.fillText(`${item.category} ${percent(item.baseAmount, total)}`, 305, y - 2);
  });
}

function handlePieClick(event: MouseEvent) {
  const canvas = event.currentTarget as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left - 150;
  const y = event.clientY - rect.top - 145;
  const distance = Math.sqrt(x * x + y * y);
  if (distance > 100 || distance < 52) return;

  let angle = Math.atan2(y, x);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  const slice = pieSlices.find((item) => angle >= item.start && angle <= item.end);
  if (slice) {
    state.selectedCategory = slice.category;
    saveState();
    render();
  }
}

function drawSavingsLineChart() {
  const canvas = document.querySelector<HTMLCanvasElement>("#savings-line");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const sorted = [...state.contributions].sort((a, b) => a.date.localeCompare(b.date));
  const points = sorted.reduce<Array<{ date: string; value: number }>>((acc, item) => {
    const previous = acc.at(-1)?.value ?? 0;
    acc.push({ date: item.date, value: previous + convertToBase(item.amount, item.currency) });
    return acc;
  }, []);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim();
  context.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 35 + i * 42;
    context.beginPath();
    context.moveTo(46, y);
    context.lineTo(390, y);
    context.stroke();
  }

  if (!points.length) {
    context.fillStyle = chartTextColor();
    context.fillText("Savings history appears here.", 110, 132);
    return;
  }

  const max = Math.max(...points.map((item) => item.value), 1);
  const xStep = points.length > 1 ? 330 / (points.length - 1) : 0;
  context.strokeStyle = "#10b981";
  context.lineWidth = 3;
  context.beginPath();
  points.forEach((point, index) => {
    const x = 50 + index * xStep;
    const y = 220 - (point.value / max) * 165;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = chartTextColor();
  context.font = "12px Inter, sans-serif";
  context.fillText(formatBase(max), 46, 24);
  context.fillText(formatShortDate(points[0].date), 46, 246);
  context.fillText(formatShortDate(points.at(-1)?.date ?? todayIso()), 300, 246);
}

function monthlyExpenseByCategory() {
  const entries = currentMonthTransactions("expense");
  const grouped = new Map<string, number>();
  entries.forEach((item) => {
    grouped.set(item.category, (grouped.get(item.category) ?? 0) + convertToBase(item.amount, item.currency));
  });
  return [...grouped.entries()]
    .map(([category, baseAmount]) => ({ category, baseAmount }))
    .sort((a, b) => b.baseAmount - a.baseAmount);
}

function groupByCategory(entries: Transaction[]) {
  return entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + convertToBase(item.amount, item.currency);
    return acc;
  }, {});
}

function groupTransactionsByCategory(entries: Transaction[]) {
  return entries.reduce<Record<string, Transaction[]>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

function currentMonthTransactions(direction: Direction) {
  const currentMonth = monthKey(new Date());
  return state.transactions.filter((item) => item.direction === direction && monthKey(new Date(item.date)) === currentMonth);
}

function totalIncomeThisMonth() {
  return currentMonthTransactions("income").reduce((sum, item) => sum + convertToBase(item.amount, item.currency), 0);
}

function totalSavingsInBase() {
  const goals = state.goals.reduce((sum, goal) => sum + convertToBase(goal.saved, goal.currency), 0);
  const wallet = state.balances.reduce((sum, balance) => sum + convertToBase(balance.amount, balance.currency), 0);
  return goals + wallet;
}

function savingsForMonth(key: string) {
  return state.contributions
    .filter((item) => monthKey(new Date(item.date)) === key)
    .reduce((sum, item) => sum + convertToBase(item.amount, item.currency), 0);
}

function convertToBase(amount: number, currency: Currency) {
  return convertCurrency(amount, currency, state.rates.base);
}

function convertCurrency(amount: number, from: Currency, to: Currency) {
  if (from === to) return amount;
  const usdAmount = from === "ARS" ? amount / state.rates.usdToArs : amount;
  if (to === "USD" || to === "USDC") return usdAmount;
  return usdAmount * state.rates.usdToArs;
}

function currencySelect(name: string, value: Currency) {
  return `
    <select name="${name}">
      ${currencies.map((currency) => `<option value="${currency}" ${selected(value, currency)}>${currency}</option>`).join("")}
    </select>
  `;
}

function applyTheme() {
  const prefersDark = getColorSchemeMedia()?.matches ?? false;
  const active = state.theme === "system" ? (prefersDark ? "dark" : "light") : state.theme;
  document.documentElement.dataset.theme = active;
}

getColorSchemeMedia()?.addEventListener?.("change", () => {
  if (state.theme === "system") {
    applyTheme();
    render();
  }
});

function chartTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
}

function uid(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

function readStoredState() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredState(value: string) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Some embedded previews and private browsing modes block storage.
  }
}

function removeStoredState() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore blocked storage cleanup; the app can continue with seed data.
  }
}

function getColorSchemeMedia() {
  return typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
}

function selected(a: string, b: string) {
  return a === b ? "selected" : "";
}

function isoFor(date: Date, day: number) {
  return new Date(date.getFullYear(), date.getMonth(), day).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeDate(value: string) {
  const separator = value.includes("/") ? "/" : "-";
  const parts = value.split(separator).map(Number);
  if (String(parts[0]).length === 4) {
    return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
  }
  const [first, second, third] = parts;
  const year = third < 100 ? 2000 + third : third;
  const dayFirst = first > 12 || second <= 12;
  const day = dayFirst ? first : second;
  const month = dayFirst ? second : first;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USDC" ? "USD" : currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  })
    .format(amount)
    .replace("$", currency === "USDC" ? "USDC " : "$");
}

function formatBase(amount: number) {
  return formatMoney(amount, state.rates.base);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function recurrenceLabel(value: Recurrence) {
  if (value === "once") return "This month only";
  return `Recurrent ${value}`;
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
