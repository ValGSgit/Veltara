// Animated cloud layer

uniform float uTime;
uniform vec3 uSunDirection;

varying vec2 vUv;
varying vec3 vNormal;

vec3 mod289c(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289c4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permutec(vec4 x) { return mod289c4(((x * 34.0) + 1.0) * x); }

float snoisec(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - 0.5;
  i = mod289c(i);
  vec4 p = permutec(permutec(permutec(i.z + vec4(0,i1.z,i2.z,1)) + i.y + vec4(0,i1.y,i2.y,1)) + i.x + vec4(0,i1.x,i2.x,1));
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m; m = m * m;
  vec4 gx = fract(p * 0.0243902439) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec3 g0 = vec3(gx.x, gy.x, 0); vec3 g1 = vec3(gx.y, gy.y, 0);
  vec3 g2 = vec3(gx.z, gy.z, 0); vec3 g3 = vec3(gx.w, gy.w, 0);
  vec4 norm = 1.79284291 - 0.85373472 * vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3));
  g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;
  return 42.0 * dot(m, vec4(dot(g0, x0), dot(g1, x1), dot(g2, x2), dot(g3, x3)));
}

void main() {
  // Animated cloud position
  vec3 pos = vec3(vUv * 4.0, uTime * 0.03);

  float cloud1 = snoisec(pos);
  float cloud2 = snoisec(pos * 2.1 + 5.2);
  float cloud3 = snoisec(pos * 4.3 - 3.1);

  float cloudDensity = cloud1 * 0.5 + cloud2 * 0.3 + cloud3 * 0.2;
  cloudDensity = smoothstep(0.15, 0.55, cloudDensity);

  // Sun illumination
  vec3 normal = normalize(vNormal);
  float sunlight = max(dot(normal, normalize(uSunDirection)) * 0.4 + 0.6, 0.0);

  vec3 cloudColor = vec3(0.98, 0.98, 1.0) * sunlight;

  gl_FragColor = vec4(cloudColor, cloudDensity * 0.75);
}
