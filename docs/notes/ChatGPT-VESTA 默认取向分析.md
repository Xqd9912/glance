# VESTA 默认取向分析

**User:** Anonymous  
**Created:** 6/26/2026 15:59:27  
**Updated:** 6/26/2026 16:18:57  
**Exported:** 6/26/2026 16:25:54  
**Link:** [https://chatgpt.com/g/g-p-6a375ccb358c81919a6c68164d494952-pretty-lattice/c/6a3e315c-a9f0-83e8-aa74-f80d0609a3d6](https://chatgpt.com/g/g-p-6a375ccb358c81919a6c68164d494952-pretty-lattice/c/6a3e315c-a9f0-83e8-aa74-f80d0609a3d6)  

## Prompt:
2026/6/26 15:59:24

请调研一下vesta里边，比如我现在点a/b/c，使得该方向指向屏幕外，那它此时是怎么决定剩下一个自由度的默认取向的。

## Response:
2026/6/26 15:59:27

我先把能公开查到的 VESTA 手册/教程和相关讨论过一遍；这个细节很可能没有明确写算法，所以我会区分“文档确认”和“根据行为/几何推断”。

结论：**VESTA 的逻辑不是“只把 a/b/c 对准屏幕法线”，而是同时确定两个向量：projection vector + upward vector。剩下那个自由度就是由 upward vector 决定的。**

官方手册里说得比较明确：VESTA 的 Orientation 里有两个方向，一个是投影方向，即“从视点到屏幕”的方向；另一个是屏幕向上的方向。投影方向可以是 direct lattice vector `[uvw]`，而在 `Project along [uvw]` 模式下，upward vector 用的是 reciprocal-lattice vector `[hkl]*`。两者必须满足 `hu + kv + lw = 0`，否则 VESTA 会自动决定/修正 upward direction。([jp-minerals.org](https://jp-minerals.org/vesta/en/doc/VESTAch10.html))

对顶部工具栏的 `a / b / c / a* / b* / c*` 按钮，官方手册只说它们是 “View along the a/b/c/a*/b*/c* axis”，没有把默认 roll 的 hard-coded 表写出来。([jp-minerals.org](https://jp-minerals.org/vesta/en/doc/VESTAch4.html)) 但结合教程里给出的默认 Orientation 数值，基本可以推断 VESTA 的默认规则是：

| 按钮 | projection vector | 默认屏幕向上 |
|---|---:|---:|
| `a` | `[100]`，沿 a 看 | `[001]*`，也就是 **c\*** 朝上 |
| `b` | `[010]`，沿 b 看 | `[001]*`，也就是 **c\*** 朝上 |
| `c` | `[001]`，沿 c 看 | `[010]*`，也就是 **b\*** 朝上 |

证据是：AIST 的 VESTA 3.1 教程明确说，按 `C` 按钮可以回到初始取向；初始 Orientation 是 projection vector 从 c 轴 `[001]`，upward vector 是 b 轴方向 `[010]`。同一教程里，为了沿 a 轴看，会把 projection 改成 `[100]`，upward 改成 `[001]`；另一个 CaTiO₃ 教程里，为了沿 b 轴看，会把 projection 改成 `[010]`，upward 也改成 `[001]`。([unit.aist.go.jp](https://unit.aist.go.jp/mmri/ja/organization/db-nomura/common/images/HELP2N-CIF-Diamond-J.pdf))

所以人话版就是：

**VESTA 侧视 a/b 的时候，尽量让 c 方向竖起来；俯视 c 的时候，让 b 方向竖起来。**

但有个非常重要的小坑：在 `Project along [uvw]` 模式里，upward vector 其实是 reciprocal vector。所以严格说不是“c 朝上”，而是 **c\* 朝上**；不是“b 朝上”，而是 **b\* 朝上**。在正交晶胞里没区别，但在 monoclinic/triclinic 里会有差别。

给 pretty-lattice 复现的话，我建议这样写：

```ts
// direct-axis view presets
a: projection = direct(1,0,0), up = reciprocal(0,0,1)
b: projection = direct(0,1,0), up = reciprocal(0,0,1)
c: projection = direct(0,0,1), up = reciprocal(0,1,0)
```

然后用 Gram-Schmidt 把 up 投影到屏幕平面内。VESTA 版本历史也提到，Projection vector 和 Upward vector 不完全正交时，会用 Gram-Schmidt 计算屏幕向上方向。([jp-minerals.org](https://jp-minerals.org/vesta/en/changes.html))

```ts
z = normalize(projection)                 // 注意 VESTA 定义是“视点 -> 屏幕”，即进屏幕
y = normalize(up - dot(up, z) * z)         // screen up
x = normalize(cross(y, z))                 // screen right，符号按你的 three.js camera 约定微调
```

如果你在 UI 里定义的是“该轴指向屏幕外/朝向用户”，那就把 `projection` 取反；roll 逻辑仍然一样。

---

**Sources:**

- [10 DEFINING DRAWING BOUNDARIES AND VIEW DIRECTIONS](https://jp-minerals.org/vesta/en/doc/VESTAch10.html)
- [例1） 3](https://unit.aist.go.jp/mmri/ja/organization/db-nomura/common/images/HELP2N-CIF-Diamond-J.pdf)

## Prompt:
2026/6/26 16:18:16

我看到vesta有一个可以输入projection vector(uvw)和Upward vector(hkl)的地方。你的意思是这俩需要正交是吗？如果输入的不正交，vesta会怎么处理？

## Response:
2026/6/26 16:18:19

对，**它们几何上需要正交**。更准确地说，在 `Project along [uvw]` 模式下：

- `Projection vector [uvw]` 表示实空间方向：  
  $p = u\mathbf a + v\mathbf b + w\mathbf c$
- `Upward vector [hkl]` 表示倒空间方向：  
  $q = h\mathbf a^* + k\mathbf b^* + l\mathbf c^*$

它们要满足：

$$
p\cdot q = hu + kv + lw = 0
$$

也就是 VESTA 手册里说的 `hu + kv + lw = 0`。如果满足，这个 upward vector 才能直接作为屏幕里的“上方”方向。官方手册明确说，不满足时，屏幕向上方向会由 VESTA 自动决定。([JP-Minerals](https://jp-minerals.org/vesta/en/doc/VESTAch10.html))

不过更具体一点，VESTA 版本历史里写过：从 v2.1.2 开始，当 `Projection vector` 和 `Upward vector` 不正交时，屏幕向上方向会用 **Gram-Schmidt process** 来计算。([JP-Minerals](https://jp-minerals.org/vesta/en/changes.html?utm_source=chatgpt.com))

所以它实际大概是这样处理的：

$$
q_{\rm screen-up}
=
q - \frac{q\cdot p}{p\cdot p}p
$$

然后再 normalize。也就是：

**它不会完全丢掉你输入的 upward vector，而是把它沿 projection 方向的分量去掉，只保留落在屏幕平面内的那部分。**

人话版：

> 你给了一个“不太水平”的 up，VESTA 会把它“压扁”到屏幕平面里，得到真正的屏幕向上方向。

比如你设：

```text
Projection vector = [100]
Upward vector     = [111]
```

这不正交，因为 $1\cdot1 + 1\cdot0 + 1\cdot0 = 1$。  
VESTA 就会把 `[111]*` 里沿 `[100]` 视线方向的成分去掉，剩下的投影作为屏幕上方。

一个细节：如果 upward vector 几乎和 projection vector 平行，那么 Gram-Schmidt 后长度会接近 0，这时这个 up 本身就没法定义 roll 角。文档没有细说这种退化情况的 fallback；我会按“VESTA 自动决定”的描述理解为它会选一个默认方向避免崩掉。

对 pretty-lattice 来说，可以直接复现成：

```ts
const view = normalize(projectionCartesian);
let up = upwardCartesian;

// Gram-Schmidt: remove component along view direction
up = sub(up, mul(view, dot(up, view)));

if (norm(up) < eps) {
  up = chooseFallbackUp(view); // 比如从 b*, c*, worldY 里挑一个不平行的
}

up = normalize(up);
const right = normalize(cross(up, view));
```

所以 UI 上可以允许用户输入不严格正交的 up vector；内部帮他正交化就行。严格模式下也可以提示：  
**“Upward vector is not perpendicular to projection vector; it will be projected onto the screen plane.”**

---

**Sources:**

- [10 DEFINING DRAWING BOUNDARIES AND VIEW DIRECTIONS](https://jp-minerals.org/vesta/en/doc/VESTAch10.html)



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)