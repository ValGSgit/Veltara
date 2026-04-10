// Planet fragment shader — biomes, day/night, city lights

uniform vec3 uSunDirection;
uniform float uTime;
uniform float uDayCycleProgress;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vElevation;

// ─── Noise (reused from vertex, needed for city lights) ───────────────────────

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute4(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute4(permute4(permute4(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ─── Biome Colors ─────────────────────────────────────────────────────────────

vec3 getBiomeColor(float elevation, float latitude) {
  float absLat = abs(latitude);

  // Below water
  if (elevation < -0.1) return vec3(0.02, 0.04, 0.18);       // deep ocean
  if (elevation < 0.02) return vec3(0.05, 0.12, 0.35);       // shallow water
  if (elevation < 0.05) return vec3(0.76, 0.70, 0.50);       // sand/beach

  // Polar regions — tundra and snow
  if (absLat > 70.0) return vec3(0.90, 0.92, 0.95);          // snow caps
  if (absLat > 55.0) return vec3(0.65, 0.72, 0.68);          // tundra

  // Mid elevations by latitude
  if (elevation < 0.2) {
    if (absLat > 40.0) return vec3(0.40, 0.55, 0.35);        // temperate forest
    if (absLat > 20.0) return vec3(0.22, 0.48, 0.20);        // grassland
    return vec3(0.72, 0.58, 0.28);                            // arid/savanna
  }

  // High elevation
  if (elevation < 0.35) return vec3(0.35, 0.28, 0.20);       // mountain brown
  if (elevation < 0.45) return vec3(0.55, 0.50, 0.45);       // rocky mountain
  return vec3(0.92, 0.94, 0.96);                              // mountain snow
}

// ─── City Lights ──────────────────────────────────────────────────────────────

float cityLights(vec3 pos) {
  // Only on land areas
  if (vElevation < 0.05) return 0.0;

  float n1 = snoise3(pos * 8.0);
  float n2 = snoise3(pos * 16.0 + vec3(100.0));
  float pattern = step(0.72, n1) * step(0.68, n2);
  return pattern * 0.9;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 sunDir = normalize(uSunDirection);

  // Latitude from normalized Y position
  float latitude = asin(clamp(normalize(vPosition).y, -1.0, 1.0)) * (180.0 / 3.14159);

  // Biome base color
  vec3 biomeColor = getBiomeColor(vElevation, latitude);

  // ─── Lighting ────────────────────────────────────────────────────────────────
  float diffuse = max(dot(normal, sunDir), 0.0);
  float ambient = 0.08;

  // Smooth day/night terminator
  float terminator = smoothstep(-0.15, 0.15, dot(normal, sunDir));

  // Day color
  vec3 dayColor = biomeColor * (ambient + diffuse);

  // Night color — dark blue with city lights
  float lights = cityLights(vPosition) * (1.0 - terminator);
  vec3 nightCity = vec3(0.95, 0.85, 0.4) * lights;
  vec3 nightColor = vec3(0.01, 0.01, 0.03) + nightCity;

  // Specular highlight on water
  float isWater = step(vElevation, 0.02);
  vec3 viewDir = normalize(cameraPosition - vPosition);
  vec3 halfDir = normalize(sunDir + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), 64.0) * isWater * 0.6;

  vec3 finalColor = mix(nightColor, dayColor, terminator) + vec3(specular);

  // Slight atmospheric tint near horizon
  float rim = 1.0 - max(dot(normal, viewDir), 0.0);
  finalColor = mix(finalColor, vec3(0.3, 0.5, 0.8), rim * rim * 0.15);

  gl_FragColor = vec4(finalColor, 1.0);
}
