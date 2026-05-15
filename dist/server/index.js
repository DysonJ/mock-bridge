"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockShopifyAdminServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const token_generator_1 = require("../auth/token-generator");
const constants_1 = require("../auth/constants");
class MockShopifyAdminServer {
    constructor(config) {
        this.config = {
            port: 3080,
            shop: "test-shop.myshopify.com",
            clientId: constants_1.STANDARD_MOCK_CLIENT_ID,
            clientSecret: constants_1.STANDARD_MOCK_SECRET,
            apiVersion: "2024-01",
            scopes: [
                "read_products",
                "write_products",
                "read_orders",
                "write_orders",
            ],
            debug: false,
            adminApi: "mock",
            ...config,
        };
        // Auto-enable HTTP proxy when appUrl is HTTPS (avoids mixed-content blocking)
        if (!this.config.proxyPort && this.config.appUrl?.startsWith("https://")) {
            this.config.proxyPort = (this.config.port ?? 3080) + 1;
        }
        this.app = (0, express_1.default)();
        this.tokenGenerator = new token_generator_1.TokenGenerator(this.config.clientSecret);
        // Initialize mock data
        this.mockShop = {
            domain: this.config.shop,
            name: "Mock Shop",
            email: "mock@shop.com",
            plan: "developer",
            createdAt: new Date().toISOString(),
        };
        this.mockUser = {
            id: this.config.userId || "123456789",
            email: "test@mockshop.com",
            firstName: "Test",
            lastName: "User",
            displayName: "Test User",
        };
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // Enable CORS for all origins in mock mode
        this.app.use((0, cors_1.default)({
            origin: true,
            credentials: true,
        }));
        this.app.use(body_parser_1.default.json());
        this.app.use(body_parser_1.default.urlencoded({ extended: true }));
        // Serve static files from client directory
        this.app.use("/static", express_1.default.static(path_1.default.join(__dirname, "../client")));
        this.app.use(express_1.default.static(path_1.default.join(__dirname, "../../admin-frame/dist")));
        // Mock Shopify Admin page with embedded app
        this.app.use("/admin/apps/:clientId", (req, res, next) => {
            // const { host, shop } = req.query;
            // Set CSP header to allow iframe embedding
            const frameSrc = this.config.proxy
                ? `'self'`
                : `'self' ${this.config.appUrl}`;
            res.setHeader("Content-Security-Policy", `frame-src ${frameSrc}; ` +
                `frame-ancestors 'self' localhost:*; ` +
                `script-src 'self' 'unsafe-inline' 'unsafe-eval';`);
            // res.send(this.getAdminHTML(host as string, shop as string));
            next();
        });
        // this.app.use('/admin', express.static(path.join(__dirname, '../../admin-frame/dist')));
        // Debug logging
        if (this.config.debug) {
            this.app.use((req, res, next) => {
                console.log(`[MockShopify] ${req.method} ${req.url}`);
                next();
            });
        }
    }
    setupRoutes() {
        // Serve logo images
        this.app.get("/logo", (req, res) => {
            res.sendFile(path_1.default.join(__dirname, "../../assets/img/mock-bridge-logo-200px.jpg"));
        });
        this.app.get("/favicon.ico", (req, res) => {
            res.sendFile(path_1.default.join(__dirname, "../../assets/img/mock-bridge-logo-200px.jpg"));
        });
        // Main admin route - serves the mock Shopify Admin page
        this.app.get("/", (req, res) => {
            const hostBase64 = Buffer.from(`https://${this.config.shop}`).toString("base64");
            res.redirect(`/admin/apps/${this.config.clientId}?host=${hostBase64}&shop=${this.config.shop}`);
        });
        this.app.get("/api/config", (req, res) => {
            res.json({
                clientId: this.config.clientId,
                shop: this.config.shop,
                appUrl: this.config.appUrl,
                appPath: this.config.appPath,
                adminApi: this.config.adminApi,
                proxy: this.config.proxy,
                proxyPort: this.config.proxyPort,
                appName: this.config.appName,
            });
        });
        // Session token endpoint
        this.app.post("/api/session-token", (req, res) => {
            const token = this.tokenGenerator.generateSessionToken({
                shop: this.config.shop,
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret,
                userId: this.mockUser.id,
            });
            res.json({ token });
        });
        // Mock GraphQL Admin API endpoint
        this.app.post("/admin/api/:version/graphql.json", (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({
                    errors: [{ message: "Unauthorized" }],
                });
            }
            // For mock purposes, return basic shop data
            res.json({
                data: {
                    shop: {
                        name: this.mockShop.name,
                        email: this.mockShop.email,
                        domain: this.mockShop.domain,
                    },
                },
            });
        });
        // Mock Admin API proxy endpoint - handles intercepted fetch calls from App Bridge
        this.app.post("/mock-admin-api", (req, res) => {
            const { url, method, body } = req.body;
            if (this.config.debug) {
                console.log(`[MockShopify] Admin API proxy: ${method} ${url}`);
            }
            // Handle GraphQL requests
            if (url.includes("/graphql.json")) {
                return this.handleMockGraphQL(req, res, body);
            }
            // Handle REST API requests
            return this.handleMockRestApi(req, res, url, method);
        });
        // Mock OAuth token exchange endpoint
        this.app.post("/admin/oauth/access_token", (req, res) => {
            const { client_id, client_secret, subject_token } = req.body;
            if (client_id !== this.config.clientId ||
                client_secret !== this.config.clientSecret) {
                return res.status(401).json({ error: "invalid_client" });
            }
            try {
                // Verify the session token
                this.tokenGenerator.verifySessionToken(subject_token);
                // Return mock access tokens
                res.json({
                    access_token: "mock_access_token_" + Date.now(),
                    scope: this.config.scopes?.join(",") || "",
                    expires_in: 86400, // 24 hours
                });
            }
            catch (error) {
                res.status(400).json({ error: "invalid_grant" });
            }
        });
        // Mock REST API endpoints
        this.app.get("/admin/api/:version/shop.json", (req, res) => {
            res.json({
                shop: this.mockShop,
            });
        });
        // Mock app bridge script (served for embedded apps)
        this.app.get("/app-bridge.js", (req, res) => {
            res.type("application/javascript");
            const srcPath = path_1.default.join(__dirname, "../../app-bridge/dist/index.js");
            res.sendFile(srcPath);
        });
        // (Dual-port HTTP proxy is started separately in startProxyServer())
        // Catch-all for undefined routes
        this.app.use("*", (req, res) => {
            if (this.config.debug) {
                console.log(`[MockShopify] Unhandled route: ${req.method} ${req.originalUrl}`);
            }
            res.status(404).json({ error: "Not found" });
        });
    }
    /**
     * Handle mock GraphQL Admin API requests
     */
    handleMockGraphQL(req, res, body) {
        const query = typeof body === "string" ? body : body?.query || "";
        // Parse the GraphQL query to determine what data to return
        const mockData = { data: {} };
        // Shop queries
        if (query.includes("shop")) {
            mockData.data.shop = {
                id: "gid://shopify/Shop/1",
                name: this.mockShop.name,
                email: this.mockShop.email,
                domain: this.mockShop.domain,
                myshopifyDomain: this.config.shop,
                plan: { displayName: "Developer" },
                primaryDomain: { url: `https://${this.mockShop.domain}` },
            };
        }
        // Products queries
        if (query.includes("products")) {
            mockData.data.products = {
                edges: [
                    {
                        node: {
                            id: "gid://shopify/Product/1",
                            title: "Mock Product 1",
                            handle: "mock-product-1",
                            status: "ACTIVE",
                            totalInventory: 100,
                            priceRangeV2: {
                                minVariantPrice: { amount: "19.99", currencyCode: "USD" },
                                maxVariantPrice: { amount: "19.99", currencyCode: "USD" },
                            },
                        },
                        cursor: "cursor1",
                    },
                    {
                        node: {
                            id: "gid://shopify/Product/2",
                            title: "Mock Product 2",
                            handle: "mock-product-2",
                            status: "ACTIVE",
                            totalInventory: 50,
                            priceRangeV2: {
                                minVariantPrice: { amount: "29.99", currencyCode: "USD" },
                                maxVariantPrice: { amount: "29.99", currencyCode: "USD" },
                            },
                        },
                        cursor: "cursor2",
                    },
                ],
                pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };
        }
        // Orders queries
        if (query.includes("orders")) {
            mockData.data.orders = {
                edges: [
                    {
                        node: {
                            id: "gid://shopify/Order/1001",
                            name: "#1001",
                            createdAt: new Date().toISOString(),
                            displayFinancialStatus: "PAID",
                            displayFulfillmentStatus: "UNFULFILLED",
                            totalPriceSet: {
                                shopMoney: { amount: "49.99", currencyCode: "USD" },
                            },
                            customer: {
                                id: "gid://shopify/Customer/1",
                                displayName: "John Doe",
                                email: "john@example.com",
                            },
                        },
                        cursor: "cursor1",
                    },
                ],
                pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };
        }
        // Customers queries
        if (query.includes("customers")) {
            mockData.data.customers = {
                edges: [
                    {
                        node: {
                            id: "gid://shopify/Customer/1",
                            displayName: "John Doe",
                            email: "john@example.com",
                            phone: "+1234567890",
                            ordersCount: "5",
                            totalSpentV2: { amount: "249.95", currencyCode: "USD" },
                        },
                        cursor: "cursor1",
                    },
                ],
                pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                },
            };
        }
        // If no specific data matched, return empty data object
        if (Object.keys(mockData.data).length === 0) {
            mockData.data = { __typename: "QueryRoot" };
        }
        res.json(mockData);
    }
    /**
     * Handle mock REST Admin API requests
     */
    handleMockRestApi(req, res, url, method) {
        // Parse the URL to determine the resource
        const urlParts = url.split("/");
        const resource = urlParts.find((part, i) => urlParts[i - 1]?.match(/^\d{4}-\d{2}$/));
        switch (resource) {
            case "shop.json":
                res.json({ shop: this.mockShop });
                break;
            case "products.json":
                res.json({
                    products: [
                        {
                            id: 1,
                            title: "Mock Product 1",
                            handle: "mock-product-1",
                            status: "active",
                            variants: [{ id: 1, price: "19.99", inventory_quantity: 100 }],
                        },
                        {
                            id: 2,
                            title: "Mock Product 2",
                            handle: "mock-product-2",
                            status: "active",
                            variants: [{ id: 2, price: "29.99", inventory_quantity: 50 }],
                        },
                    ],
                });
                break;
            case "orders.json":
                res.json({
                    orders: [
                        {
                            id: 1001,
                            name: "#1001",
                            created_at: new Date().toISOString(),
                            financial_status: "paid",
                            fulfillment_status: null,
                            total_price: "49.99",
                            customer: { id: 1, email: "john@example.com" },
                        },
                    ],
                });
                break;
            case "customers.json":
                res.json({
                    customers: [
                        {
                            id: 1,
                            email: "john@example.com",
                            first_name: "John",
                            last_name: "Doe",
                            orders_count: 5,
                            total_spent: "249.95",
                        },
                    ],
                });
                break;
            default:
                // Return empty response for unknown resources
                if (this.config.debug) {
                    console.log(`[MockShopify] Unknown REST resource: ${resource}`);
                }
                res.json({});
        }
    }
    startProxyServer() {
        if (!this.config.proxyPort)
            return Promise.resolve();
        const adminPort = this.config.port ?? 3080;
        const proxyPort = this.config.proxyPort;
        const appUrl = this.config.appUrl;
        // Inline script injected into every HTML page served from the proxy.
        // Runs synchronously before any external scripts (including Angular bundles),
        // so both patches are in effect before app-bridge-core's createApp() runs.
        //
        // 1. URL.prototype.origin patch — patches the *prototype getter* so every call
        //    to .origin on any URL instance (including those in Angular's bundled
        //    app-bridge-core that captured the constructor before this script ran) uses
        //    the patched getter at call time. This makes postMessage target the admin frame
        //    instead of the Shopify shop domain.
        //
        // 2. fetch/XHR rewrite — routes https://localhost:PORT/... through /__local-https
        //    so API calls bypass browser CORS (backend only allows https://localhost:4200).
        const headPatchScript = `
<script>
(function(){
  var _adminOrigin = 'http://localhost:${adminPort}';
  window.__mockAdminOrigin = _adminOrigin;
  var _desc = Object.getOwnPropertyDescriptor(URL.prototype, 'origin');
  var _origGetter = _desc && _desc.get;
  if (_origGetter) {
    Object.defineProperty(URL.prototype, 'origin', {
      get: function() {
        var orig = _origGetter.call(this);
        return orig.endsWith('.myshopify.com') ? _adminOrigin : orig;
      },
      configurable: true,
    });
  }
  var _proxyBase = 'http://localhost:${proxyPort}/__local-https/';
  function rewrite(url) {
    if (typeof url === 'string') {
      var m = url.match(/^https:\\/\\/localhost:(\\d+)(\\/.*)$/);
      if (m) return _proxyBase + m[1] + m[2];
    }
    return url;
  }
  var _fetch = window.fetch;
  window.fetch = function(url, opts) { return _fetch.call(this, rewrite(url), opts); };
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = rewrite(url);
    return _open.apply(this, args);
  };
})();
</script>`;
        // Build the app-bridge.js response with the correct admin origin prepended.
        const appBridgeSrc = path_1.default.join(__dirname, "../../app-bridge/dist/index.js");
        return new Promise((resolve, reject) => {
            const proxyApp = (0, express_1.default)();
            // 1. Serve app-bridge.js locally so Angular can load it from same origin.
            //    Prepend __mockAdminOrigin so the URL patch targets port 3080 (admin),
            //    not port 3081 (proxy).
            proxyApp.get("/app-bridge.js", (_req, res) => {
                try {
                    const src = fs_1.default.readFileSync(appBridgeSrc, "utf8");
                    res.type("application/javascript");
                    res.send(`window.__mockAdminOrigin="http://localhost:${adminPort}";\n` + src);
                }
                catch {
                    res.status(500).send("// app-bridge.js not found");
                }
            });
            // 2. /__local-https/:port/... — forwards to https://localhost:PORT server-side,
            //    bypassing browser CORS.
            proxyApp.use("/__local-https", (0, http_proxy_middleware_1.createProxyMiddleware)({
                router: (req) => {
                    const m = req.url?.match(/^\/(\d+)/);
                    return m ? `https://localhost:${m[1]}` : appUrl;
                },
                pathRewrite: (urlPath) => urlPath.replace(/^\/\d+/, "") || "/",
                changeOrigin: true,
                secure: false,
                on: {
                    error: (err, _req, _res) => {
                        if (this.config.debug) {
                            console.error(`[MockShopify] Local-HTTPS proxy error:`, err);
                        }
                    },
                },
            }));
            // 3. Catch-all: proxy everything else to the Angular dev server.
            //    responseInterceptor is used to inject the fetch-rewrite script into HTML
            //    so the browser rewrites API calls through /__local-https.
            const mainProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
                target: appUrl,
                changeOrigin: true,
                secure: false,
                selfHandleResponse: true,
                on: {
                    proxyReq: (_proxyReq, req) => {
                        if (this.config.debug) {
                            console.log(`[MockShopify] HTTP Proxy: ${req.method} ${req.url} -> ${appUrl}${req.url}`);
                        }
                    },
                    proxyRes: (0, http_proxy_middleware_1.responseInterceptor)(async (responseBuffer, proxyRes) => {
                        const contentType = proxyRes.headers["content-type"] ?? "";
                        if (contentType.includes("text/html")) {
                            const html = responseBuffer.toString("utf8");
                            return html.replace("<head>", "<head>" + headPatchScript);
                        }
                        return responseBuffer;
                    }),
                    error: (err, _req, _res) => {
                        if (this.config.debug) {
                            console.error(`[MockShopify] Proxy error:`, err);
                        }
                    },
                },
            });
            proxyApp.use(mainProxy);
            this.proxyServer = proxyApp.listen(proxyPort, () => {
                console.log(`🔀 HTTP Proxy: http://localhost:${proxyPort} -> ${appUrl}`);
                resolve();
            });
            this.proxyServer.on("error", reject);
            // Reuse the same proxy instance for WS upgrades (Angular HMR / live-reload).
            this.proxyServer.on("upgrade", mainProxy.upgrade);
        });
    }
    async start() {
        await this.startProxyServer();
        return new Promise((resolve) => {
            this.server = this.app.listen(this.config.port, () => {
                console.log(`
🚀 Mock Shopify Admin Server Started!
====================================
📍 URL: http://localhost:${this.config.port}
🏪 Shop: ${this.config.shop}
🔑 Client ID: ${this.config.clientId}
🎯 App URL: ${this.config.appUrl}${this.config.proxyPort ? "\n🔀 HTTP Proxy: http://localhost:" + this.config.proxyPort + " -> " + this.config.appUrl : ""}
====================================
        `);
                resolve();
            });
        });
    }
    async stop() {
        const closeMain = new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            }
            else {
                resolve();
            }
        });
        const closeProxy = new Promise((resolve) => {
            if (this.proxyServer) {
                this.proxyServer.close(() => resolve());
            }
            else {
                resolve();
            }
        });
        await Promise.all([closeMain, closeProxy]);
        console.log("Mock Shopify Admin Server stopped");
    }
    getConfig() {
        return this.config;
    }
}
exports.MockShopifyAdminServer = MockShopifyAdminServer;
//# sourceMappingURL=index.js.map