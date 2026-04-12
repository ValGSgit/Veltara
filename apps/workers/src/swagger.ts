export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Veltara API",
    version: "1.0.0",
    description: "API documentation for Veltara services: Game Client, Authentication, and Developer API."
  },
  servers: [
    {
      url: "/",
      description: "Current environment"
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JWT for authenticated user actions"
      },
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "vlt_xxx",
        description: "Developer API Key"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              status: { type: "integer" }
            }
          }
        }
      }
    }
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                  username: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "User registered" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Successful login" }
        }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refresh_token"],
                properties: {
                  refresh_token: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Token refreshed" }
        }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Logout",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  refresh_token: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Logged out" }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get current user profile",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "User profile" }
        }
      }
    },
    "/api/regions": {
      get: {
        tags: ["Game Client"],
        summary: "Get regions with player counts",
        responses: {
          "200": { description: "List of regions" }
        }
      }
    },
    "/api/world-state": {
      get: {
        tags: ["Game Client"],
        summary: "Get world state",
        responses: {
          "200": { description: "Current world state" }
        }
      }
    },
    "/api/players/join": {
      post: {
        tags: ["Game Client"],
        summary: "Assign player to a region",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lon: { type: "number" },
                  region_id: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Joined region" }
        }
      }
    },
    "/api/players/{id}": {
      get: {
        tags: ["Game Client"],
        summary: "Get player profile",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Player profile" }
        }
      }
    },
    "/api/events": {
      post: {
        tags: ["Game Client"],
        summary: "Trigger world event",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "title", "description"],
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  region_id: { type: "string" },
                  duration_sec: { type: "number" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Event triggered" }
        }
      }
    },
    "/api/developer/keys": {
      get: {
        tags: ["Developer API"],
        summary: "List API keys",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of keys" }
        }
      },
      post: {
        tags: ["Developer API"],
        summary: "Generate API key",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "New API key" }
        }
      }
    },
    "/api/developer/keys/{id}": {
      delete: {
        tags: ["Developer API"],
        summary: "Revoke API key",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Key revoked" }
        }
      }
    },
    "/api/developer/usage": {
      get: {
        tags: ["Developer API"],
        summary: "Get developer usage stats",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Usage stats" }
        }
      }
    },
    "/v1/regions": {
      get: {
        tags: ["Developer API (Public)"],
        summary: "List regions with player counts",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": { description: "Regions list" }
        }
      }
    },
    "/v1/world-state": {
      get: {
        tags: ["Developer API (Public)"],
        summary: "Get world state",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": { description: "World state" }
        }
      }
    },
    "/v1/events": {
      post: {
        tags: ["Developer API (Public)"],
        summary: "Trigger event",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "title", "description"],
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  region_id: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Event created" }
        }
      }
    },
    "/v1/players/online": {
      get: {
        tags: ["Developer API (Public)"],
        summary: "Online player count",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": { description: "Player count" }
        }
      }
    },
    "/v1/embed/session": {
      post: {
        tags: ["Developer API (Public)"],
        summary: "Create embed session token",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  region_id: { type: "string" },
                  user_label: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Session token" }
        }
      }
    }
  }
};

export function getSwaggerUI(urlPath: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veltara API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css" >
  <style>
    html
    {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }

    *,
    *:before,
    *:after
    {
      box-sizing: inherit;
    }

    body
    {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>

<body>
  <div id="swagger-ui"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js"> </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js"> </script>
  <script>
  window.onload = function() {
    const ui = SwaggerUIBundle({
      url: "${urlPath}",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: "StandaloneLayout"
    })
    window.ui = ui
  }
</script>
</body>
</html>
`;
}
