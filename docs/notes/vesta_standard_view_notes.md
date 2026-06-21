# VESTA 的 Standard View / 默认视角调研笔记

## 调研结论

你的感觉有依据，但需要区分两个不同概念：

- **VESTA 的初始 / 复位视角**：沿 **c 轴**观察，所以 c 轴大体是垂直屏幕的，而不是在屏幕平面内向上。
- **VESTA 常见的侧视姿态**：经常让 **c\*** 朝屏幕上方；在大多数正交、四方、立方和常用六方晶胞中，`c* ∥ c`，所以看起来就是“c 轴始终向上”。

VESTA 当前文档中并没有一个单独命名为 “Standard View” 的固定三维视角；它提供的是 Orientation 对话框，以及沿 `a, b, c, a*, b*, c*` 观察的六个对齐按钮。

---

## 1. VESTA 的初始 / 复位视角

VESTA 把相机姿态拆成两个独立约束：

```text
Projection direction D
Screen-up direction U
```

在 `Project along [uvw]` 模式下：

```math
D = u a + v b + w c
```

但屏幕向上方向使用的是倒易晶格向量：

```math
U = h a^* + k b^* + l c^*
```

它们应满足：

```math
hu + kv + lw = 0
```

也就是相互垂直。

AIST 的 VESTA 3.1.x 教程明确写出了初始值：

```text
D = [001] = c
U = [010]* = b*
```

并且说明按工具栏的 `C` 按钮会回到这个初始视角。

所以准确地说，VESTA 的初始画面是：

```text
            b*：屏幕向上
                 ↑
                 |
                 +--------→ a 的屏幕投影

            c：垂直屏幕、沿观察轴
```

对于正交晶胞，它就简化为：

- `a` 向右；
- `b` 向上；
- `c` 沿屏幕法线。

因此，**VESTA 的初始视角不是“c 向上”，而是“沿 c 看”。**

---

## 2. 为什么看起来经常是 c 向上

VESTA 官方手册中的 Orientation 示例使用的是：

```text
D = [110] = a + b
U = [001]* = c*
```

也就是沿基面内的 `[110]` 方向观察，并让 `c*` 朝屏幕上方。

这个示例是 MgB₂，采用六方晶胞。在这种晶胞中：

```math
c^* \parallel c
```

所以画面里看到的确实就是直接晶格的 c 轴竖直。大量立方、四方、正交和六方结构也有这个性质，因此很容易形成“VESTA 总是让 c 向上”的印象。

但一般情况下：

```math
c^* \propto a \times b
```

即 `c*` 是 `ab` 平面的法向量，**不一定与直接晶格的 c 轴平行**。对单斜、三斜以及部分非标准晶胞，二者会明显不同。

| 姿态 | 观察轴 `D` | 屏幕上方 `U` | 实际效果 |
|---|---|---|---|
| VESTA 初始 / 复位 | `c = [001]` | `b* = [010]*` | c 沿视线 |
| 官方手册侧视示例 | `a + b = [110]` | `c* = [001]*` | `c*` 竖直 |
| “直接 c 永远竖直” | 选择任意 `D ⟂ c` | `c` | 直接 c 严格竖直 |

---

## 3. 按 VESTA 方式实现

先由直接晶格向量计算倒易基矢，省略不影响方向的 `2π`：

```text
V  = dot(a, cross(b, c))

a* = cross(b, c) / V
b* = cross(c, a) / V
c* = cross(a, b) / V
```

给定 VESTA 风格的 `[uvw]` 和 `[hkl]*`：

```text
D0 = u*a + v*b + w*c
U0 = h*a* + k*b* + l*c*

D = normalize(D0)
U = normalize(U0 - D * dot(U0, D))   // Gram–Schmidt
R = normalize(cross(U, D))
U = normalize(cross(D, R))
```

其中：

- `D` 是观察方向；
- `U` 是屏幕向上方向；
- `R` 是屏幕向右方向。

VESTA 对不完全正交的投影向量和向上向量也采用 Gram–Schmidt 正交化。

按 VESTA Orientation 矩阵的排列方式，可以写成：

```text
M = [
  R,
  U,
  D
]
```

即三行分别是：

```text
screen-right
screen-up
screen-normal
```

VESTA 开发者也说明其内部笛卡尔坐标约定为：

```text
x：屏幕向右
y：屏幕向上
z：垂直屏幕
```

如果你的渲染引擎规定相机朝局部 `-Z` 看，则第三行或 camera forward 需要使用 `-D`。

---

## 4. 给 pretty-lattice / 晶体渲染程序的建议

我建议把两个概念明确分开：

### 4.1 `Reset / VESTA View`

严格复现 VESTA：

```text
D0 = c
U0 = b*
```

也就是：

```text
projection = [001]
upward     = [010]*
```

这个适合作为：

- “VESTA-compatible reset”；
- “look along c”；
- “top view along c”。

但它不适合作为所有结构的漂亮默认展示图，因为很多结构会被压成二维俯视图。

---

### 4.2 `Standard View`

作为真正面向用户的默认展示视角，建议采用**三分之四视角，并保证直接 c 轴的屏幕投影向上**：

```text
D = normalize(normalize(a) + normalize(b) + normalize(c))
U = normalize(c - D * dot(c, D))
R = normalize(cross(U, D))
```

这样有三个优点：

1. 屏幕上看到的 c 轴始终竖直；
2. 不会像严格侧视那样把结构压成近似二维；
3. 立方晶胞下自然接近经典的 `[111]` 等轴测视角。

这个可以命名为：

```text
standard_view = "three_quarter_c_up"
```

或者更简单：

```text
standard_view = "c_up"
```

但内部文档里最好说明它不是 VESTA 的 reset view，而是一个面向展示美观性的默认视图。

---

### 4.3 如果想严格让 c 轴位于屏幕平面内

若要求的是更严格的“c 轴本身完全位于屏幕平面内并向上”，则使用：

```text
U  = normalize(c)
D0 = normalize(a) + normalize(b)
D  = normalize(D0 - U * dot(D0, U))
R  = normalize(cross(U, D))
```

这相当于一种直接晶格版本的：

```text
沿 [110] 侧看，c 向上
```

它更接近很多材料图里的传统侧视图，尤其适合层状材料、薄膜、表面、界面等体系。

不过它的问题是：如果结构本身沿 `a+b` 方向有强重叠，画面可能不如三分之四视角自然。

---

## 5. 推荐的产品定义

最准确的产品定义可以写成：

> **VESTA-compatible reset**：沿 c 看，b* 向上。  
> **pretty-lattice standard view**：三分之四观察，直接 c 的屏幕投影向上。

也就是说：

```text
VESTA reset:
    view_direction = c
    screen_up      = b*

pretty-lattice standard:
    view_direction = a + b + c
    screen_up      = projection of c onto screen
```

如果要做 CLI / Python API，可以考虑：

```text
prl render input.cif --view standard
prl render input.cif --view vesta-reset
prl render input.cif --view c-up
prl render input.cif --view along-c
```

其中：

```text
standard    = three_quarter_c_up
vesta-reset = D=[001], U=[010]*
along-c     = D=[001], U=[010]*
c-up        = side / three-quarter view with direct c projected upward
```

---

## 6. 最终建议

我的建议是：

```text
默认展示图：three_quarter_c_up
VESTA 兼容复位：along_c_bstar_up
```

也就是不要把 VESTA 的初始视角直接当成渲染程序的默认标准视角。VESTA 的初始视角更像“晶胞坐标复位”，而你的程序需要的是“出图好看且稳定”的默认 camera pose。

一句话总结：

> VESTA 的 reset view 是沿 c 看、b* 向上；  
> 但你的 standard view 更适合定义成 c 轴在屏幕中向上、并带一点三分之四透视 / 正交斜视。

---

## 参考资料

1. VESTA Manual, Orientation dialogue:  
   <https://jp-minerals.org/vesta/en/doc/VESTAch4.html>

2. VESTA Orientation example image:  
   <https://jp-minerals.org/vesta/en/doc/images/dlg_orientation.png>

3. VESTA change log, note on Gram–Schmidt orthonormalization:  
   <https://jp-minerals.org/vesta/en/changes.html>

4. AIST VESTA tutorial, initial projection direction and upward direction:  
   <https://unit.aist.go.jp/mmri/ja/organization/db-nomura/common/images/HELP3N-CIF-CaTiO3-J.pdf>

5. VESTA-discuss thread, coordinate convention x/y/z:  
   <https://groups.google.com/g/vesta-discuss/c/Quu_x13R1kM>
