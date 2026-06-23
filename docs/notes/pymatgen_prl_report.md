
# Pymatgen 功能调研报告（用于 pretty-lattice 后端替代 ASE）

## 1. 概述

pymatgen（Python Materials Genomics）是一个面向材料科学的数据结构与分析库，核心对象是 `Structure` / `Lattice`，并在此基础上提供丰富的局域结构分析、成键判定、配位多面体分析以及对称性分析功能。

---

## 2. 成键（Bonding / Neighbor）算法能力

pymatgen 不使用单一“成键定义”，而是提供多种 **Nearest Neighbor Finder（NNF）** 策略：

### 2.1 常见邻近/成键算法

位于 `pymatgen.analysis.local_env`：

- **MinimumDistanceNN**
  - 基于最近距离阈值
  - 最简单、最快
  - 类似 ASE cutoff

- **VoronoiNN**
  - 基于 Voronoi tessellation
  - 通过共享面判定邻居
  - 更接近“结构几何真实邻接”

- **CrystalNN**
  - pymatgen 最常用默认方案之一
  - 结合 Voronoi + electronegativity + distance weighting
  - 输出带权重的配位关系（推荐用于结构分析）

- **EconNN**
  - 基于电子亲和/电负性 + 距离修正（较旧）

- **CovalentBondNN**
  - 基于共价半径判定
  - 更偏化学键意义（适合分子/有机体系）

所有 NN 方法统一接口：
```python
get_nn_info(structure, index)
```

---

## 3. 多面体（Coordination Polyhedra）分析

### 3.1 主要模块

#### （1）Chemenv（强烈推荐）
路径：
```
pymatgen.analysis.chemenv
```

功能：
- 自动识别 coordination environment（配位环境）
- 识别理想多面体类型：
  - tetrahedron
  - octahedron
  - square planar
  - trigonal prism 等
- 输出：
  - coordination number
  - shape match score
  - distortion metrics

👉 这是 pymatgen 中最“VESTA-like”的部分。

---

#### （2）StructureGraph + Local Environment

```
pymatgen.analysis.graphs.StructureGraph
```

功能：
- 将晶体转为图结构（节点=原子，边=键）
- 可基于 NN 方法构图
- 可用于：
  - polyhedra extraction
  - bond network analysis

---

#### （3）Voronoi-based Polyhedra

- 使用 VoronoiNN
- 每个中心原子的 Voronoi neighbors 构成 polyhedron
- 可直接用于可视化（非常适合 PRL）

---

## 4. 对称性分析（空间群 / 点群 / 晶系）

### 4.1 核心类

```
pymatgen.symmetry.analyzer.SpacegroupAnalyzer
```

⚠️ 内部依赖：spglib

---

### 4.2 可输出内容

给定 Structure，可以获得：

#### 空间群（Space group）
- Hermann–Mauguin symbol（如 `Fm-3m`）
- International number（如 225）

```python
sga.get_space_group_symbol()
sga.get_space_group_number()
```

---

#### 点群（Point group）
```python
sga.get_point_group_symbol()
```

例如：
- m-3m
- 6/mmm
- 432

---

#### 晶系（Crystal system）
```python
sga.get_crystal_system()
```

输出：
- triclinic
- monoclinic
- orthorhombic
- tetragonal
- trigonal
- hexagonal
- cubic

---

#### 晶格系统（lattice system）
pymatgen 不直接作为独立字段提供，但可由 crystal system 推导。

---

## 5. 是否可以替代 spglib？

### 结论：❌ 不能完全替代

- pymatgen.symmetry = **spglib wrapper**
- spglib 是底层实现
- pymatgen 提供：
  - 更 Python-friendly API
  - 更高层语义封装

👉 本质关系：

```
pymatgen.symmetry.analyzer
        ↓
     spglib
```

因此：

| 功能 | pymatgen | spglib |
|------|----------|--------|
| 空间群 | ✔ wrapper | ✔ core |
| 点群 | ✔ | ✔ |
| 晶系 | ✔ | ✔ |
| 高级接口 | ✔✔ | ❌ |
| 性能 | 中等 | 更快 |

👉 结论：
- 可以 **替代你直接使用 spglib**
- 但不能移除 spglib 依赖

---

## 6. pymatgen.core 能力范围

核心模块：

```
pymatgen.core
```

主要类：

### 6.1 Structure（核心）
- 周期性晶体结构
- atomic sites
- lattice vectors
- symmetry operations interface

### 6.2 Lattice
- 3x3 晶格矩阵
- 转换 cartesian ↔ fractional

### 6.3 Site
- 单个原子位置
- 元素 + 坐标 + occupancy

### 6.4 Molecule（非周期）
- 分子结构（可选）

---

## 7. pymatgen vs ASE（针对 PRL 项目）

### ASE
- 更偏 MD / calculator framework
- bonding / symmetry = relatively basic
- 可扩展但“低层”

### pymatgen
- 更偏 materials analysis
- 强项：
  - bonding graph
  - coordination polyhedra
  - symmetry analysis
  - structure classification

👉 对 PRL 更关键能力：

| 功能 | ASE | pymatgen |
|------|-----|----------|
| bond finding | basic | rich (CrystalNN etc) |
| polyhedra | weak | strong (chemenv) |
| symmetry | basic | strong (spglib wrapper) |
| materials database style | weak | strong |

---

## 8. 结论

### pymatgen适合PRL的原因：
- 提供多种 bond definition（可视化控制友好）
- Chemenv 可直接用于 polyhedra detection（非常关键）
- SpacegroupAnalyzer 足够覆盖 spglib 使用场景
- Structure 是完整晶体数据结构（适合前端渲染 pipeline）

### 关键限制：
- symmetry 仍依赖 spglib
- polyhedra algorithm 较重（Chemenv）
- API 偏“analysis-oriented”，不是 rendering-oriented

---

## 9. 推荐架构建议（PRL）

建议：

- pymatgen = **backend analysis layer**
- three.js = rendering layer
- 自己封装一层：

```text
Structure (pymatgen)
   ↓
BondGraph (CrystalNN)
   ↓
Polyhedra (Chemenv / Voronoi)
   ↓
RenderModel (PRL custom JSON)
```

