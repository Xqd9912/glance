# Crystal Toolkit 功能边界调研

## 简短结论

Crystal Toolkit 不是一个纯后端库。它是 Materials Project 做的 **Python-first 材料科学 Web App 框架**：底层大量使用 pymatgen，上层用 Plotly Dash 把结构、相图、能带、XRD、局域环境等材料对象包装成可交互网页组件。

对 Pretty Lattice 来说，更合适的策略是 **借鉴，不直接依赖**。我们应该继续直接依赖 pymatgen 做结构 IO 和材料分析，保留自己的 FastAPI + React + Three.js 场景协议；Crystal Toolkit 适合作为显示语义和边界情况的参考实现。

## 调研范围

本报告基于本地仓库 `/Users/ftsong/Projects/repos/crystaltoolkit`：

- remote: `https://github.com/materialsproject/crystaltoolkit.git`
- branch: `main`
- inspected commit: `396bec63717b67a6f5a8ec071f9470ff551dce82`
- commit date: 2026-06-09

主要查看了：

- `README.md`
- `pyproject.toml`
- `docs_rst/introduction.rst`
- `docs_rst/first_web_app.rst`
- `docs_rst/first_component.rst`
- `docs_rst/components/dash_components.rst`
- `crystal_toolkit/core/mpcomponent.py`
- `crystal_toolkit/core/plugin.py`
- `crystal_toolkit/core/scene.py`
- `crystal_toolkit/components/structure.py`
- `crystal_toolkit/renderables/structure.py`
- `crystal_toolkit/renderables/structuregraph.py`
- `crystal_toolkit/renderables/site.py`
- `crystal_toolkit/core/legend.py`

## 它负责什么

Crystal Toolkit 对 web 程序负责得很多，不是只提供后端分析函数。

第一层是 Dash app 框架。用户主要写 Python：实例化 Dash app，创建 Crystal Toolkit 组件，把组件的 `.layout()` 放进页面，再用插件或注册函数让 callbacks、生效的 `dcc.Store`、缓存、CSS 等接起来。也就是说，它会参与页面结构、状态存储、回调绑定、默认样式和生产部署建议。

第二层是材料科学组件库。它的 `MPComponent` 子类包括结构/分子查看、XRD、相图、Pourbaix、能带、声子、局域环境、结构变换、上传和搜索等。这些组件不只是“算一下数据”，而是带布局、控件和交互逻辑的网页模块。

第三层是 scene / renderable。它定义了 Python 端的 `Scene` 和几何 primitive，例如 sphere、cylinder、line、arrow、convex surface、label 等。然后通过 `get_scene()` 之类的方法，把 pymatgen 的 `Structure`、`StructureGraph`、`Site`、`Lattice` 转成 scene JSON。最终渲染由 `dash-mp-components` 里的 Dash 组件完成，内部使用 Three.js。

第四层是材料可视化的默认实践。它在 pymatgen 之上补了很多显示决策：VESTA / Jmol / accessible 配色、半径策略、boundary image atoms、unit cell 外的一跳 bonded atoms、基于 pymatgen `NearNeighbors` 的 bond graph、简单 polyhedra、磁矩、tooltip、下载导出按钮和 scene controls。

## 比 pymatgen 多了什么

pymatgen 是材料科学数据结构和分析算法库，核心是 `Structure` / `Lattice` / `StructureGraph` / symmetry / neighbor finding / file IO。

Crystal Toolkit 多出来的是 **把 pymatgen 对象变成可交互网页的桥**：

- pymatgen / Materials Project 对象的 Dash component 封装；
- render-ready 的 scene primitive schema；
- Dash 状态、callback、控件和缓存组织方式；
- 元素颜色、原子半径、legend、boundary atoms、bonds、polyhedra、axes、download 等显示默认值；
- 一组 Materials Project 风格的 example apps 和完整 app shell。

可以粗略理解为：

```text
pymatgen = 材料数据模型和分析算法
Crystal Toolkit = pymatgen-aware 的 Dash UI 框架和 scene generator
```

它不是 pymatgen 的替代品，而是大量使用 pymatgen。它也不是我们现在这种 React 前端库；它的 web 边界是 Dash 加 Materials Project 自己维护的 Dash/React 组件。

## 和 Pretty Lattice 的关系

Pretty Lattice 当前方向是：

```text
Python backend: structure IO, materials analysis, scene generation
Web frontend: React + Three.js rendering and interaction
Local app shell: FastAPI / Uvicorn served through `prl gui`
```

Crystal Toolkit 会跨过这个边界。它希望 Python/Dash 直接负责页面结构、控件状态、callbacks 和很多 web 交互。而 Pretty Lattice 已经把 web 体验放在 React + React Three Fiber 里，并且保留项目自有的 `SceneSpec`。

直接依赖 Crystal Toolkit 会带来比较大的架构牵引：我们会被拉向 Dash、`dash-mp-components`、它自己的 component/state/callback 模型。依赖面也偏重，包括 `dash`、`dash-mp-components`、`flask-caching`、`mp-api`、`scikit-image`、`scikit-learn`、`shapely`、`webcolors`、`ipython`，还有一堆 optional server / Jupyter / VTK / phonon / fermi 依赖。

对一个轻量本地渲染工具来说，为了复用少量 scene-building 经验而继承这些东西，不太划算。

## 建议

建议把 Crystal Toolkit 当作参考实现，而不是 runtime dependency。

适合借鉴：

- boundary atom 和 one-hop bonded atom 的显示语义；
- 小型 scene primitive vocabulary 的设计；
- VESTA/Jmol/accessibility 配色和半径策略；
- 基于 pymatgen `StructureGraph` 的 bonds / polyhedra 生成流程；
- 分析失败不摧毁整个 preview 的 warning 处理；
- Materials Project 用户对结构、XRD、symmetry、local environment 面板的预期。

不建议直接采用：

- Dash 作为 Pretty Lattice app 框架；
- `StructureMoleculeComponent` 作为我们的 viewer；
- 直接把 Crystal Toolkit scene JSON 当成长期前后端协议；
- 在核心后端里依赖它 monkey-patch 出来的 `get_scene()` 方法；
- 让它的控件模型决定我们的 visual-control UX。

比较干净的路线是：

```text
Pretty Lattice -> pymatgen directly -> project-owned SceneSpec -> React Three Fiber
Crystal Toolkit -> reference for display recipes and edge cases
```

## 什么情况下可以重新考虑直接依赖

如果 Pretty Lattice 以后改方向，变成一个“尽量不写 JS、全 Python/Dash 搭界面”的材料 dashboard，那 Crystal Toolkit 会很有吸引力。

如果只是做一个内部对照 demo，也可以单独依赖它快速试验。

但对当前目标，也就是现代 web 交互 + publication-ready crystal rendering，直接依赖它主要买到的是现成 Dash UI，付出的代价是前端控制权、包体复杂度和架构清晰度。

