// chart4.js
// Doanh số bán hàng trung bình theo ngày trong tuần (Thứ 2 → CN)

function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d\.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDateSafe(s) {
  if (!s) return null;
  let d = new Date(s);
  if (!isNaN(d)) return d;
  const t1 = d3.timeParse("%Y-%m-%d %H:%M:%S")(s);
  if (t1) return t1;
  const t2 = d3.timeParse("%Y-%m-%d")(s);
  if (t2) return t2;
  const s2 = s.replace('T', ' ').split('.')[0];
  d = new Date(s2);
  return isNaN(d) ? null : d;
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

d3.csv("data_ggsheet.csv").then(raw => {
  raw.forEach(r => {
    r._dateObj = parseDateSafe(r["Thời gian tạo đơn"]);
    r._revenue = parseNumber(r["Thành tiền"]);
    r._qty = parseNumber(r["SL"]);
  });

  const withDate = raw.filter(r => r._dateObj);

  // Tổng doanh số và số lượng mỗi ngày
  const perDate = d3.rollup(
    withDate,
    rows => ({
      revenue: d3.sum(rows, r => r._revenue),
      qty: d3.sum(rows, r => r._qty)
    }),
    r => {
      const d = r._dateObj;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  );

  const dateArr = Array.from(perDate, ([dateKey, val]) => {
    const d = new Date(dateKey);
    return {
      dateKey,
      dateObj: d,
      revenue: val.revenue,
      qty: val.qty,
      weekday: d.getDay() // 0=CN, 1=T2...
    };
  });

  // Trung bình doanh số và SL theo weekday
  const perWeekday = d3.rollup(
    dateArr,
    days => ({
      revenue: d3.mean(days, dd => dd.revenue),
      qty: d3.mean(days, dd => dd.qty)
    }),
    dd => dd.weekday
  );

  // Thứ tự: Thứ 2 → Thứ 7 → Chủ Nhật
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayNames = {
    1: "Thứ Hai",
    2: "Thứ Ba",
    3: "Thứ Tư",
    4: "Thứ Năm",
    5: "Thứ Sáu",
    6: "Thứ Bảy",
    0: "Chủ Nhật"
  };

  const data = weekdayOrder.map(w => ({
    weekday: w,
    display: weekdayNames[w],
    revenue: (perWeekday.get(w) ? perWeekday.get(w).revenue : 0),
    qty: (perWeekday.get(w) ? perWeekday.get(w).qty : 0)
  }));

  // Layout
  const margin = { top: 50, right: 40, bottom: 70, left: 100 };
  const innerWidth = 900;
  const innerHeight = 420;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  d3.select("#chart4").selectAll("*").remove();
  const svg = d3.select("#chart4").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.display))
    .range([0, innerWidth])
    .paddingInner(0.35) // tăng khoảng trắng giữa cột
    .paddingOuter(0.18);

  const y = d3.scaleLinear()
    .domain([0, (d3.max(data, d => d.revenue) || 1) * 1.2])
    .range([innerHeight, 0])
    .nice();

  const color = d3.scaleOrdinal().domain(data.map(d => d.display)).range(d3.schemeSet2);

  // Vẽ lưới ngang
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke", "#ddd").attr("stroke-dasharray", "3,3"));

  // Trục X
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").remove())
    .selectAll("text")
    .style("font-size", "13px")
    .style("fill", "#333");

  // Trục Y
  g.append("g")
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickFormat(d => (d / 1e6) + "M") // đổi sang triệu
    )
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").remove())
    .selectAll("text")
    .style("font-size", "13px")
    .style("fill", "#333");

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");

  // Vẽ cột
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.display))
    .attr("y", d => y(d.revenue))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.revenue))
    .attr("rx", 6)
    .attr("fill", d => color(d.display))
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", d3.color(color(d.display)).darker(0.7));
      tooltip.style("visibility", "visible")
        .html(`
          <b>${escapeHtml(d.display)}</b><br/>
          Doanh số bán TB: ${d3.format(",.0f")(d.revenue)} VND<br/>
          Số lượng bán TB: ${d3.format(",.0f")(d.qty)} SKUs
        `);
    })
    .on("mousemove", function (event) {
      tooltip.style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function (event, d) {
      d3.select(this).attr("fill", color(d.display));
      tooltip.style("visibility", "hidden");
    });

  // Nhãn giá trị trên cột
  g.selectAll(".barValue")
    .data(data)
    .enter().append("text")
    .attr("class", "barValue")
    .attr("x", d => x(d.display) + x.bandwidth() / 2)
    .attr("y", d => y(d.revenue) - 10)
    .attr("text-anchor", "middle")
    .text(d => d3.format(",.0f")(d.revenue) + " VND");

  // Tiêu đề
  svg.append("text")
    .attr("x", svgW / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .text("Doanh số bán hàng trung bình theo Ngày trong Tuần");
});
