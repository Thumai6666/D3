// Q11.js
// Phân phối số lượt mua của khách hàng (Số lần mua -> số khách hàng)
// Đọc data.csv (cột: "Mã khách hàng", "Mã đơn hàng")

d3.csv("data_ggsheet.csv").then(raw => {
  // --- Chuẩn hóa & lọc ---
  const rows = raw.filter(d => d["Mã khách hàng"] && d["Mã đơn hàng"]);
  const ordersByCustomer = new Map();
  rows.forEach(r => {
    const cid = r["Mã khách hàng"];
    const oid = r["Mã đơn hàng"];
    if (!ordersByCustomer.has(cid)) ordersByCustomer.set(cid, new Set());
    ordersByCustomer.get(cid).add(oid);
  });

  const purchaseCounts = Array.from(ordersByCustomer.values()).map(s => s.size);

  if (purchaseCounts.length === 0) {
    d3.select("#chart11").append("div").text("Không có dữ liệu hợp lệ.");
    return;
  }

  const countMap = new Map();
  purchaseCounts.forEach(n => {
    countMap.set(n, (countMap.get(n) || 0) + 1);
  });

  const maxTimes = d3.max(purchaseCounts);
  const data = [];
  for (let t = 1; t <= maxTimes; t++) {
    data.push({
      times: t,
      customers: countMap.get(t) || 0
    });
  }

  // --- Layout ---
  d3.select("#chart11").selectAll("*").remove();
  const containerNode = d3.select("#chart11").node();
  const containerW = containerNode ? containerNode.getBoundingClientRect().width : 1200;

  const margin = { top: 40, right: 20, bottom: 60, left: 80 };
  const svgW = Math.max(800, containerW);
  const width = svgW - margin.left - margin.right;
  const height = 520 - margin.top - margin.bottom;

  const svg = d3.select("#chart11")
    .append("svg")
    .attr("width", svgW)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // --- Scales ---
  const x = d3.scaleBand()
    .domain(data.map(d => String(d.times)))
    .range([0, width])
    .padding(0.15);

  const yMax = d3.max(data, d => d.customers);
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.06])
    .nice()
    .range([height, 0]);

  // --- Grid ngang ---
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y)
      .ticks(6)
      .tickSize(-width)
      .tickFormat(""))
    .call(g => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#ddd")
    .attr("stroke-dasharray", "4,4");

  // --- Bars ---
  const bar = g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(String(d.times)))
    .attr("y", d => y(d.customers))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.max(0, height - y(d.customers)))
    .attr("rx", 4)  // bo tròn nhẹ
    .attr("fill", "#4279a6");

  // --- Tooltip ---
  const tooltip = d3.select("body").select(".tooltip");
  if (tooltip.empty()) {
    d3.select("body").append("div").attr("class", "tooltip");
  }
  const tsel = d3.select("body").select(".tooltip");

  bar.on("mouseover", function(event, d) {
      d3.select(this).attr("fill", d3.color("#4279a6").darker(0.6));
      tsel.style("visibility", "visible")
        .html(`<b>Đã mua ${d.times} lần</b><br/>Số lượng KH: ${d3.format(",")(d.customers)}`);
    })
    .on("mousemove", function(event) {
      tsel.style("left", (event.pageX + 12) + "px")
         .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("fill", "#4279a6");
      tsel.style("visibility", "hidden");
    });

  // --- Trục X ---
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .call(g => g.selectAll("path, line").attr("stroke", "#bbb")) // làm trục nhạt
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // --- Trục Y ---
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",")))
    .call(g => g.selectAll("path, line").attr("stroke", "#bbb")) // làm trục nhạt
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // --- Tiêu đề & nhãn ---
  svg.append("text")
    .attr("x", svgW / 2)
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .text("Phân phối số lượt mua hàng của khách hàng");

  svg.append("text")
    .attr("x", margin.left + width / 2)
    .attr("y", height + margin.top + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Số lần mua");

  svg.append("text")
    .attr("transform", `translate(14, ${margin.top + height/2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Số khách hàng");
});
